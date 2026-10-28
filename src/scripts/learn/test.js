// Mock Test mode: the state's format, a seeded draw, an optional timer, and results scored at the end.
// The running attempt lives in the store, so a reload before the deadline can resume it.
import { confirm, openSheet } from "./dialog.js";
import {
  LETTERS,
  bringIntoView,
  choiceText,
  clone,
  cloneOne,
  figure,
  fillAnswer,
  fitSheet,
  markTile,
  reducedMotion,
  setKey,
  setKeysRange,
  shuffledIds,
  slot,
  knob,
  watchSheetHeight,
} from "./question.js";
import { A_PERCENT, drawMockTest, pickSeed, resolveSeed, rngFor, scoreTest } from "../../lib/seeded.js";

/** Seeds a new draw avoids: the last this many in the state's history. */
const AVOID_SEEDS = 10;
/** How long an untimed test waits to be resumed. */
const UNTIMED_GRACE_MS = 24 * 60 * 60 * 1000;
/** Minutes left at which the timer warns. */
const WARN_AT = [5, 1];

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function mount(ctx) {
  const { panel, data, store } = ctx;
  const fmt = data.format;
  const timer = slot(ctx.tools, "timer");
  const timerText = slot(ctx.tools, "timer-text");
  const timerLeft = slot(ctx.tools, "timer-left");
  const barQuestions = ctx.tools.querySelector('[data-action="navigator"]');
  const barResults = ctx.tools.querySelector('[data-action="results"]');
  /** The running test's answered-progress line, above its card. */
  let progress = null;
  const navigator = /** @type {HTMLDialogElement} */ (document.getElementById("test-navigator"));
  const timeup = /** @type {HTMLDialogElement} */ (document.getElementById("test-timeup"));

  let pool = null;
  let seed = null;
  /** "intro" | "run" | "results" | "review" */
  let screen = null;
  let attempt = null;
  let result = null;
  let ticking = 0;
  const warned = new Set();
  let review = { list: [], at: 0, missedOnly: false };
  /** The running test's navigator sidebar, shown from 1248. */
  let side = null;
  const sheetHeight = watchSheetHeight(panel);
  /** Refits review's sheet around the question when the window or text size changes. */
  const reviewFit = new ResizeObserver(([entry]) => {
    const card = panel.querySelector(".qcard--review");
    if (screen === "review" && card) fitSheet(panel.querySelector(".review"), card, /** @type {HTMLElement} */ (entry.target));
  });
  /** Relabels the last question's button when the sidebar comes or goes. */
  const sideWatch = new ResizeObserver(() => {
    if (screen === "run" && attempt) labelNext();
  });

  const record = () => store.stateRecord(data.cert, data.state);
  const recentSeeds = () => record().tests.slice(0, AVOID_SEEDS).map((t) => t.seed);
  const announce = (text) => {
    const live = slot(panel, "live");
    if (live) live.textContent = text;
  };

  /** The seed lives in memory; a `seed` in the URL stays only while it names the test on screen. */
  const dropSeedParam = () => {
    const url = new URL(location.href);
    if (!url.searchParams.has("seed") || url.searchParams.get("seed") === seed) return;
    url.searchParams.delete("seed");
    ctx.replaceUrl(url.pathname + url.search + url.hash);
  };

  /** Puts one screen in the panel; only a running test shows the timer and the navigator in the bar. */
  const setScreen = (name, node, focus) => {
    screen = name;
    if (ctx.isActive()) dropSeedParam();
    sheetHeight.disconnect();
    sideWatch.disconnect();
    reviewFit.disconnect();
    panel.style.setProperty("--answer-h", "0px");
    side = null;
    panel.replaceChildren(node);
    progress = slot(panel, "progress");
    const running = name === "run";
    timer.hidden = !running;
    barQuestions.hidden = !running;
    barResults.hidden = name !== "review";
    if (focus) {
      window.scrollTo({ top: 0, behavior: "instant" });
      slot(panel, "heading")?.focus({ preventScroll: true });
    }
  };

  /** The in-progress attempt, if it can still be resumed; one past its deadline is dropped unscored. */
  const resumable = () => {
    const open = record().inProgress;
    if (!open) return null;
    const expired = open.timed ? Date.now() >= open.deadline : Date.now() - open.startedAt > UNTIMED_GRACE_MS;
    if (!expired && open.items.every((item) => pool.byKey.has(item.k))) return open;
    store.dropTest(data.cert, data.state);
    return null;
  };

  // ---- Intro -------------------------------------------------------------------------------------

  function showIntro(next, focus = true) {
    seed = next;
    const node = clone("tpl-test-intro");
    node.querySelector('[data-action="start"]').addEventListener("click", () => {
      const timed = panel.querySelector('input[name="timing"]:checked')?.value !== "untimed";
      start(timed);
    });
    setScreen("intro", node, focus);
  }

  /** Picks a test in progress back up where it was left, its clock still the one it started with. */
  function resume(open) {
    attempt = structuredClone(open);
    seed = attempt.seed;
    // Warnings already passed stay quiet.
    warned.clear();
    if (attempt.timed) for (const m of WARN_AT) if (attempt.deadline - Date.now() <= m * 60000) warned.add(m);
    showRun();
  }

  // ---- Running -----------------------------------------------------------------------------------

  function start(timed) {
    const drawn = drawMockTest(pool.questions, pool.quota, rngFor(data.cert, data.state, seed));
    const now = Date.now();
    attempt = {
      seed,
      startedAt: now,
      timed,
      count: drawn.length,
      pass: fmt.pass,
      minutes: fmt.minutes,
      deadline: timed ? now + fmt.minutes * 60000 : null,
      current: 0,
      items: drawn.map((q) => ({ k: q.k, order: shuffledIds(q.choices), chose: null, flag: false })),
    };
    warned.clear();
    store.startTest(data.cert, data.state, attempt);
    showRun();
  }

  const save = () => store.updateTest(data.cert, data.state, { items: attempt.items, current: attempt.current });

  function showRun() {
    setScreen("run", clone("tpl-test-run"), false);
    window.scrollTo({ top: 0, behavior: "instant" });
    const card = panel.querySelector(".qcard--test");
    side = panel.querySelector(".testrun__side");
    card.querySelector('[data-action="prev"]').addEventListener("click", () => go(attempt.current - 1));
    card.querySelector('[data-action="next"]').addEventListener("click", () => {
      if (attempt.current < attempt.items.length - 1) go(attempt.current + 1);
      else if (sideShown()) submit();
      else openNavigator();
    });
    card.querySelector('[data-action="navigator"]').addEventListener("click", openNavigator);
    card.querySelector('[data-action="flag"]').addEventListener("click", toggleFlag);
    side.querySelector('[data-action="submit"]').addEventListener("click", submit);
    sideWatch.observe(side);
    startClock();
    go(attempt.current);
  }

  /** Whether the navigator is on screen as the sidebar. */
  const sideShown = () => Boolean(side?.offsetParent);

  /** The last question's button: Submit beside the sidebar, Review and submit where it opens the navigator. */
  function labelNext() {
    const next = panel.querySelector('.qcard--test [data-action="next"]');
    const last = attempt.current === attempt.items.length - 1;
    next.textContent = !last ? "Next" : sideShown() ? "Submit" : "Review and submit";
    next.setAttribute("aria-haspopup", last && !sideShown() ? "dialog" : "false");
  }

  /** Shows question i and moves focus to its stem. */
  function go(i) {
    if (!attempt || i < 0 || i >= attempt.items.length) return;
    attempt.current = i;
    const item = attempt.items[i];
    const q = pool.byKey.get(item.k);
    const card = panel.querySelector(".qcard--test");
    const n = attempt.items.length;
    slot(card, "count").textContent = `Question ${i + 1} of ${n}`;
    const stem = slot(card, "stem");
    stem.textContent = q.q;
    card.classList.toggle("qcard--media", Boolean(q.media));
    slot(card, "figure").replaceChildren(...[figure(q, pool)].filter(Boolean));

    const tiles = slot(card, "tiles");
    tiles.replaceChildren(
      ...item.order.map((id, index) => {
        const tile = cloneOne("tpl-radio");
        const input = /** @type {HTMLInputElement} */ (tile.querySelector("input"));
        Object.assign(input, { name: `q-${item.k}`, value: id, checked: item.chose === id });
        setKey(tile.querySelector(".tile__key"), LETTERS[index]);
        slot(tile, "text").textContent = choiceText(q, id);
        input.addEventListener("change", () => choose(id));
        return tile;
      }),
    );

    syncFlag();
    setKeysRange(panel, item.order.length);
    card.querySelector('[data-action="prev"]').toggleAttribute("disabled", i === 0);
    labelNext();
    save();
    syncProgress();
    bringIntoView(card);
    stem.focus({ preventScroll: true });
  }

  function choose(id) {
    attempt.items[attempt.current].chose = id;
    save();
    syncProgress();
  }

  function syncFlag() {
    const flagged = attempt.items[attempt.current].flag;
    const button = panel.querySelector('[data-action="flag"]');
    button.setAttribute("aria-pressed", String(flagged));
    slot(button, "flag-label").textContent = flagged ? "Flagged" : "Flag for review";
  }

  function toggleFlag() {
    const item = attempt.items[attempt.current];
    item.flag = !item.flag;
    syncFlag();
    save();
    syncProgress();
  }

  function syncProgress() {
    const n = attempt.items.length;
    const answered = attempt.items.filter((item) => item.chose !== null).length;
    progress.firstElementChild.style.inlineSize = `${(answered / n) * 100}%`;
    slot(barQuestions, "answered").textContent = `, ${answered} of ${n} answered`;
    if (side) {
      slot(side, "side-summary").textContent = navSummary();
      fillGrid(slot(side, "side-grid"), (i) => go(i));
    }
  }

  // ---- The clock ---------------------------------------------------------------------------------

  function tick() {
    if (!attempt) return;
    if (!attempt.timed) {
      timerText.textContent = "Untimed";
      timerLeft.hidden = true;
      timer.classList.remove("timer--warn", "timer--urgent");
      return;
    }
    const left = attempt.deadline - Date.now();
    if (left <= 0) {
      timeout();
      return;
    }
    const seconds = Math.ceil(left / 1000);
    const warn = seconds <= WARN_AT[0] * 60;
    const urgent = seconds <= WARN_AT.at(-1) * 60;
    timer.classList.toggle("timer--warn", warn && !urgent);
    timer.classList.toggle("timer--urgent", urgent);
    timerText.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
    timerLeft.hidden = !warn;
    for (const minutes of WARN_AT) {
      if (seconds > minutes * 60 || warned.has(minutes)) continue;
      warned.add(minutes);
      announce(`${plural(minutes, "minute")} left`);
      if (!reducedMotion()) timer.animate(
        [{ transform: "scale(1)" }, { transform: "scale(1.08)" }, { transform: "scale(1)" }],
        { duration: knob("--dur-pulse"), easing: "ease-in-out" },
      );
    }
  }

  const onVisible = () => {
    if (document.visibilityState === "visible") tick();
  };

  function startClock() {
    stopClock();
    tick();
    ticking = window.setInterval(tick, 250);
    document.addEventListener("visibilitychange", onVisible);
  }

  function stopClock() {
    window.clearInterval(ticking);
    document.removeEventListener("visibilitychange", onVisible);
  }

  function timeout() {
    stopClock();
    timerText.textContent = "0:00";
    panel.querySelector(".qcard__fieldset")?.setAttribute("disabled", "");
    if (navigator.open) navigator.close();
    // A submit or leave prompt still open is answered "no": time's up says what happened instead.
    const asking = document.getElementById("learn-confirm");
    if (asking?.open) asking.close("cancel");
    finish("timeout");
    timeup.addEventListener("close", () => showResults(true), { once: true });
    timeup.showModal();
  }

  // ---- Navigator and submit ------------------------------------------------------------------------

  const timeupButton = timeup.querySelector('[data-action="results"]');
  timeupButton.addEventListener("click", () => timeup.close());

  /** "12 of 25 answered, 2 flagged". */
  const navSummary = () => {
    const answered = attempt.items.filter((item) => item.chose !== null).length;
    const flagged = attempt.items.filter((item) => item.flag).length;
    return `${answered} of ${attempt.items.length} answered${flagged ? `, ${flagged} flagged` : ""}`;
  };

  /** One numbered button per question, its state by fill, flag and ring; a press goes to it. */
  function fillGrid(grid, onPick) {
    grid.replaceChildren(
      ...attempt.items.map((item, i) => {
        const li = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        button.className = "nav-cell";
        button.classList.toggle("nav-cell--answered", item.chose !== null);
        button.classList.toggle("nav-cell--flagged", item.flag);
        if (i === attempt.current) button.setAttribute("aria-current", "step");
        button.textContent = String(i + 1);
        button.setAttribute(
          "aria-label",
          `Question ${i + 1}, ${item.chose !== null ? "answered" : "not answered"}${item.flag ? ", flagged" : ""}`,
        );
        button.addEventListener("click", () => onPick(i));
        li.append(button);
        return li;
      }),
    );
  }

  function openNavigator() {
    slot(navigator, "summary").textContent = navSummary();
    fillGrid(slot(navigator, "grid"), (i) => {
      navigator.close();
      go(i);
    });
    openSheet(navigator);
  }

  navigator.querySelector('[data-action="submit"]').addEventListener("click", submit);
  barQuestions.addEventListener("click", openNavigator);
  barResults.addEventListener("click", () => showResults(true));

  async function submit() {
    if (!attempt) return;
    const open = attempt.items.filter((item) => item.chose === null).length;
    const flagged = attempt.items.filter((item) => item.flag).length;
    if (open || flagged) {
      const still = open && flagged
        ? `${plural(open, "question")} unanswered and ${flagged} flagged`
        : open
          ? `${plural(open, "question")} unanswered`
          : `${plural(flagged, "question")} flagged`;
      const go = await confirm({
        title: "Submit your test?",
        body: `You still have ${still}.`,
        keep: "Keep working",
        proceed: "Submit",
      });
      if (!go || !attempt) return;
    }
    if (navigator.open) navigator.close();
    finish("complete");
    showResults(true);
  }

  /** Scores the attempt, files it, and closes it. */
  function finish(status) {
    stopClock();
    const items = attempt.items.map((item) => ({
      ...item,
      right: item.chose !== null && item.chose === pool.byKey.get(item.k)?.answer,
    }));
    const correct = items.filter((item) => item.right).length;
    const finished = {
      seed: attempt.seed,
      startedAt: attempt.startedAt,
      endedAt: Date.now(),
      timed: attempt.timed,
      count: items.length,
      pass: attempt.pass,
      minutes: attempt.minutes,
      correct,
      status,
      items: items.map(({ k, chose, order, flag, right }) => ({ k, chose, order, flag, right })),
    };
    store.finishTest(data.cert, data.state, finished);
    result = { ...finished, score: scoreTest(correct, items.length, attempt.pass) };
    attempt = null;
  }

  // ---- Results -----------------------------------------------------------------------------------

  /** Each drawn topic's tally, the weak ones (under the A) first by misses, then curriculum order. */
  const topicTally = () => {
    const tally = new Map();
    for (const item of result.items) {
      const topic = pool.byKey.get(item.k)?.topic;
      if (!topic) continue;
      const row = tally.get(topic) ?? { topic, n: 0, right: 0 };
      row.n++;
      if (item.right) row.right++;
      tally.set(topic, row);
    }
    const order = pool.topics.map((t) => t.slug);
    const rows = [...tally.values()].map((row) => ({ ...row, weak: row.right * 100 < A_PERCENT * row.n }));
    const weak = rows.filter((r) => r.weak).sort((a, b) => b.n - b.right - (a.n - a.right) || order.indexOf(a.topic) - order.indexOf(b.topic));
    const strong = rows.filter((r) => !r.weak).sort((a, b) => order.indexOf(a.topic) - order.indexOf(b.topic));
    return [...weak, ...strong];
  };

  function showResults(focus) {
    const node = clone("tpl-test-results");
    const { score, count, pass } = result;
    const needed = Math.ceil((pass * count) / 100);
    const head = node.querySelector(".results__head");
    head.classList.toggle("results--passed", score.passed);
    head.classList.toggle("results--a", score.a);
    slot(node, "verdict").textContent = score.passed ? "You passed" : "Not a pass yet";
    const pct = slot(node, "pct");
    pct.textContent = `${score.percent}%`;
    pct.style.setProperty("--score", String(score.percent));
    pct.style.setProperty("--pass", String(pass));
    slot(node, "line").textContent = score.passed
      ? `${score.correct} of ${count} correct (${score.percent}%). The pass mark is ${pass}%.`
      : `${score.correct} of ${count} correct (${score.percent}%). You needed ${needed} correct (${pass}%).`;
    const from = slot(node, "pass-from");
    if (data.passFrom && pass === fmt.pass) {
      const link = Object.assign(document.createElement("a"), {
        href: data.passFrom.url,
        target: "_blank",
        rel: "noopener noreferrer",
        textContent: data.passFrom.title,
      });
      from.append("Pass mark from the ", link);
    } else {
      from.textContent = "Pass mark set by LanternCert, since none is published";
    }

    if (!score.a) slot(node, "a").remove();

    const topics = slot(node, "topics");
    for (const row of topicTally()) {
      const topic = pool.topicBySlug.get(row.topic);
      const li = cloneOne("tpl-topic-score");
      li.classList.toggle("topic-scores__row--weak", row.weak);
      slot(li, "emoji").textContent = topic.emoji;
      slot(li, "name").textContent = topic.name;
      slot(li, "count").textContent = `${row.right} of ${row.n}`;
      const pips = slot(li, "pips");
      for (let i = 0; i < row.n; i++) {
        const pip = document.createElement("span");
        pip.className = i < row.right ? "pip pip--on" : "pip";
        if (i < row.right) pip.style.setProperty("--i", String(i));
        pips.append(pip);
      }
      const read = slot(li, "read");
      read.setAttribute("href", `${data.learn}?mode=guide#${row.topic}`);
      read.innerHTML = `Read<span class="visually-hidden"> about ${topic.name} in the Study Guide</span>`;
      const practice = slot(li, "practice");
      practice.setAttribute("href", `${data.learn}?mode=cards&topics=${row.topic}`);
      practice.innerHTML = `Practice<span class="visually-hidden"> ${topic.name}</span>`;
      topics.append(li);
    }

    const misses = result.items.filter((item) => !item.right).length;
    const reviewRow = slot(node, "review");
    const button = (label, primary, onClick) => {
      const el = Object.assign(document.createElement("button"), { type: "button", className: primary ? "btn" : "tool-btn", textContent: label });
      el.addEventListener("click", onClick);
      return el;
    };
    if (misses) {
      reviewRow.append(button(misses === 1 ? "Review the one you missed" : `Review the ${misses} you missed`, true, () => showReview(true)));
    }
    reviewRow.append(button("Review every question", !misses, () => showReview(false)));

    node.querySelector('[data-action="retake"]').addEventListener("click", () => showIntro(result.seed));
    node.querySelector('[data-action="new"]').addEventListener("click", () =>
      showIntro(pickSeed([...recentSeeds(), result.seed])),
    );
    setScreen("results", node, focus);
    countUp(slot(panel, "pct"), score.percent);
  }

  /** Counts the score up from zero, easing out; under reduced motion it simply shows. */
  function countUp(element, to) {
    if (reducedMotion() || !to) return;
    const ms = knob("--dur-count");
    const start = performance.now();
    const frame = (now) => {
      const t = Math.min(1, (now - start) / ms);
      element.textContent = `${Math.round(to * (1 - (1 - t) ** 3))}%`;
      if (t < 1 && element.isConnected) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  // ---- Review ------------------------------------------------------------------------------------

  function showReview(missedOnly) {
    const list = result.items.map((item, index) => ({ item, index })).filter(({ item }) => !missedOnly || !item.right);
    review = { list, at: 0, missedOnly };
    setScreen("review", clone("tpl-test-review"), false);
    const sheet = panel.querySelector(".answer");
    sheet.querySelector('[data-action="prev"]').addEventListener("click", () => showReviewItem(review.at - 1));
    sheet.querySelector('[data-action="next"]').addEventListener("click", () => showReviewItem(review.at + 1));
    sheetHeight.observe(sheet);
    reviewFit.observe(sheet);
    showReviewItem(0);
  }

  /** One reviewed question: only the reader's pick and the right answer, then its answer in the sheet. */
  function showReviewItem(at) {
    if (at < 0 || at >= review.list.length) return;
    review.at = at;
    const { item, index } = review.list[at];
    const q = pool.byKey.get(item.k);
    const topic = pool.topicBySlug.get(q.topic);
    const card = panel.querySelector(".qcard--review");
    const sheet = panel.querySelector(".answer");
    slot(card, "count").textContent = review.missedOnly
      ? `Missed question ${at + 1} of ${review.list.length}`
      : `Question ${index + 1} of ${result.items.length}`;
    slot(card, "emoji").textContent = topic.emoji;
    slot(card, "topic").textContent = topic.name;
    const stem = slot(card, "stem");
    stem.textContent = q.q;
    stem.tabIndex = -1;
    card.classList.toggle("qcard--media", Boolean(q.media));
    slot(card, "figure").replaceChildren(...[figure(q, pool)].filter(Boolean));

    const tiles = slot(card, "tiles");
    tiles.replaceChildren(
      ...item.order
        .map((id, i) => ({ id, letter: LETTERS[i] }))
        .filter(({ id }) => id === q.answer || id === item.chose)
        .map(({ id, letter }) => {
          const tile = document.createElement("li");
          tile.className = "tile tile--static";
          tile.innerHTML = '<span class="tile__key" aria-hidden="true"></span><span class="tile__text" data-slot="text"></span><span class="tile__verdict" data-slot="verdict"></span>';
          setKey(tile.querySelector(".tile__key"), letter);
          slot(tile, "text").textContent = choiceText(q, id);
          if (id === q.answer) markTile(tile, "right", item.chose === id ? "Correct" : "Correct answer");
          else markTile(tile, "wrong", "Your answer");
          return tile;
        }),
    );

    const kind = item.chose === null ? "none" : item.right ? "right" : "wrong";
    fillAnswer(sheet, q, pool, data.learn, kind);
    sheet.querySelector('[data-action="prev"]').toggleAttribute("disabled", at === 0);
    sheet.querySelector('[data-action="next"]').toggleAttribute("disabled", at === review.list.length - 1);
    window.scrollTo({ top: 0, behavior: "instant" });
    fitSheet(panel.querySelector(".review"), card, sheet, { reveal: true });
    stem.focus({ preventScroll: true });
  }

  // ---- Keys: only while focus is inside the stage --------------------------------------------------

  panel.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.defaultPrevented) return;
    const target = /** @type {HTMLElement} */ (event.target);
    if (target.closest?.(".testrun__side")) return;
    const key = event.key.toLowerCase();
    if (screen === "review") {
      if (key === "arrowleft") showReviewItem(review.at - 1);
      else if (key === "arrowright") showReviewItem(review.at + 1);
      return;
    }
    if (screen !== "run") return;
    const index = "abcd".includes(key) ? "abcd".indexOf(key) : "1234".indexOf(key);
    const radios = [...panel.querySelectorAll('.qcard--test input[type="radio"]')];
    if (index >= 0 && radios[index]) {
      event.preventDefault();
      const radio = /** @type {HTMLInputElement} */ (radios[index]);
      radio.checked = true;
      // Focus follows the pick only from within the choices; from the question it stays put.
      if (radios.includes(target)) radio.focus();
      else announce(`${LETTERS[index]} selected`);
      choose(radio.value);
    } else if (key === "f") {
      event.preventDefault();
      toggleFlag();
    } else if (key === "arrowleft") {
      // ← → move between questions even from a choice; ↑ ↓ still move within the choices.
      event.preventDefault();
      go(attempt.current - 1);
    } else if (key === "arrowright") {
      event.preventDefault();
      go(attempt.current + 1);
    } else if (key === "enter" && !target.closest?.("a, button") && attempt.current < attempt.items.length - 1) {
      event.preventDefault();
      go(attempt.current + 1);
    }
  });

  // ---- Mounting ----------------------------------------------------------------------------------

  const ready = ctx
    .pool()
    .then((loaded) => {
      pool = loaded;
    })
    .catch((error) => {
      const status = panel.querySelector(".skeleton");
      status?.replaceChildren(cloneOne("tpl-load-error"));
      panel.querySelector('[data-action="retry"]')?.addEventListener("click", () => location.reload());
      throw error;
    });

  return {
    ready,
    heading: () => slot(panel, "heading"),
    enter(url, { initial }) {
      ready
        .then(() => {
          if (screen === "run") return;
          const asked = url.searchParams.get("seed");
          const known = resolveSeed(asked);
          // A test left running picks up where it was, its clock never having stopped.
          const open = resumable();
          if (open) {
            resume(open);
            return;
          }
          // A link's seed opens that test; without one, the screen showing stays.
          if (screen && (!known || known === seed)) {
            dropSeedParam();
            return;
          }
          showIntro(known ?? pickSeed(recentSeeds()), false);
        })
        .catch(() => {});
    },
    /** A running test asks before it is left, and ends unscored if it is. */
    async guard() {
      if (screen !== "run" || !attempt) return true;
      const leave = await confirm({
        title: "Leave the test?",
        body: "This attempt will end and won't be scored.",
        keep: "Stay in the test",
        proceed: "Leave",
      });
      if (!leave) return false;
      if (!attempt) return true;
      stopClock();
      store.dropTest(data.cert, data.state);
      attempt = null;
      screen = null;
      return true;
    },
  };
}
