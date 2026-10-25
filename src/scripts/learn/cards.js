// Practice Cards mode: one card at a time from an endless deck, untimed, with no counter anywhere.
// An answer opens in a sheet docked at the stage's foot. Answers write to the store as mode "c".
import { openSheet } from "./dialog.js";
import {
  LETTERS,
  choiceText,
  clone,
  cloneOne,
  figure,
  fillAnswer,
  knob,
  listPhrase,
  markTile,
  reducedMotion,
  shuffledIds,
  slot,
  watchSheetHeight,
} from "./question.js";
import { missedKeys } from "../../lib/missed.js";
import { shuffle } from "../../lib/seeded.js";

export function mount(ctx) {
  const { panel, data, store } = ctx;
  const filterButton = ctx.tools.querySelector('[data-action="filter"]');
  const filterSummary = slot(ctx.tools, "filter-summary");
  const dialog = /** @type {HTMLDialogElement} */ (document.getElementById("cards-filter"));

  let pool = null;
  let stageEl = null;
  let deckEl = null;
  let live = null;
  let sheet = null;
  let side = null;
  /** The filter in force: null topics means all of them. */
  let filter = { topics: null, missed: false };
  let deck = [];
  /** Cards dealt so far, part of each card's ids. */
  let dealt = 0;
  let card = null;

  const tracking = () => store.status().tracking;
  const record = () => store.stateRecord(data.cert, data.state);
  const missedCount = () => [...missedKeys(record().answers)].filter((k) => pool.byKey.has(k)).length;

  // ---- The filter ---------------------------------------------------------------------------------

  /** The filter a URL asks for; unknown topics are dropped silently. */
  const filterFrom = (url) => {
    const asked = (url.searchParams.get("topics") ?? "").split(",").filter((slug) => pool.topicBySlug.has(slug));
    const topics = asked.length && asked.length < pool.topics.length ? [...new Set(asked)] : null;
    return { topics, missed: url.searchParams.get("missed") === "1" && tracking() };
  };

  const sameFilter = (a, b) => a.missed === b.missed && String(a.topics) === String(b.topics);

  const urlFor = (f) => {
    const url = new URL(data.learn, location.href);
    url.searchParams.set("mode", "cards");
    if (f.topics) url.searchParams.set("topics", f.topics.join(","));
    if (f.missed) url.searchParams.set("missed", "1");
    return url.pathname + url.search;
  };

  const summary = (f) => {
    const topics = f.topics?.length === 1 ? pool.topicBySlug.get(f.topics[0]).name : f.topics ? `${f.topics.length} topics` : null;
    if (f.missed) return topics ? `${topics}, missed only` : "Missed only";
    return topics ?? "All topics";
  };

  const matches = (f, missed) => (q) => (!f.topics || f.topics.includes(q.topic)) && (!f.missed || missed.has(q.k));

  /** The line over the card below 1248: what this pass covers, the missed count as it starts. */
  function syncPracticing() {
    const line = slot(panel, "practicing");
    if (!line) return;
    if (filter.missed) {
      const n = pool.questions.filter(matches(filter, missedKeys(record().answers))).length;
      line.textContent = n ? `Practicing ${n} missed ${n === 1 ? "question" : "questions"}` : "Practicing missed questions";
    } else if (!filter.topics) {
      line.textContent = "Practicing all topics";
    } else if (filter.topics.length === 1) {
      line.textContent = `Practicing ${pool.topicBySlug.get(filter.topics[0]).name}`;
    } else {
      line.textContent = "Practicing selected topics";
    }
  }

  // ---- The deck -----------------------------------------------------------------------------------

  /** A fresh pass over the filter, shuffled, leaving out a card still on screen. */
  const shuffleDeck = (except = null) => {
    const missed = missedKeys(record().answers);
    return shuffle(pool.questions.filter(matches(filter, missed)).map((q) => q.k).filter((k) => k !== except));
  };

  /** The next key, never a sister of the card just shown. */
  const draw = () => {
    const last = card ? pool.byKey.get(card.q.k) : null;
    const i = deck.findIndex((k) => !last?.sisters.includes(k));
    return deck.splice(Math.max(i, 0), 1)[0];
  };

  // ---- Rendering ----------------------------------------------------------------------------------

  /** Swaps the card on the stack: the old one slides off, the new one rises from the deck. */
  const place = async (node, { focus = true } = {}) => {
    const old = deckEl.querySelector(".qcard:not(.qcard--leaving)");
    deckEl.append(node);
    stageEl.classList.toggle("cards__stage--quiet", !card);
    if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: "instant" });
    const enter = node.querySelector(".qcard__stem, .qcard__note-title");
    if (focus) enter?.focus({ preventScroll: true });
    closeSheet();
    if (!old) return;
    old.classList.add("qcard--leaving");
    old.setAttribute("inert", "");
    const ms = reducedMotion() ? knob("--dur-fade") : knob("--dur-next");
    const out = reducedMotion()
      ? [{ opacity: 1 }, { opacity: 0 }]
      : [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateX(-2rem)" }];
    const into = reducedMotion()
      ? [{ opacity: 0 }, { opacity: 1 }]
      : [{ opacity: 0, transform: "translateY(0.75rem) scale(0.97)" }, { opacity: 1, transform: "none" }];
    node.animate(into, { duration: ms, easing: "ease-out" });
    await old.animate(out, { duration: ms, easing: "ease-in" }).finished.catch(() => {});
    old.remove();
  };

  /** A message card; `lead` opens its title in the accent, swept in. */
  const note = ({ lead = null, title, text = null, actions }) => {
    const node = cloneOne("tpl-card-note");
    const heading = slot(node, "title");
    if (lead) heading.append(Object.assign(document.createElement("span"), { className: "page-title__accent sweep-in", textContent: lead }), " ");
    heading.append(title);
    if (text) {
      slot(node, "text").textContent = text;
      slot(node, "text").hidden = false;
    }
    const row = slot(node, "actions");
    actions.forEach(({ label, href, onClick }, i) => {
      const el = document.createElement(href ? "a" : "button");
      el.className = i === 0 ? "btn" : "tool-btn";
      el.textContent = label;
      if (href) {
        el.setAttribute("href", href);
        el.dataset.learn = "";
      } else {
        el.setAttribute("type", "button");
        el.addEventListener("click", onClick);
      }
      row.append(el);
    });
    card = null;
    return node;
  };

  const allTopics = () => ctx.replaceUrl(urlFor({ topics: null, missed: false }));
  const testHref = `${data.learn}?mode=test`;

  const endCard = () => {
    const missed = missedKeys(record().answers);
    const empty = !pool.questions.some(matches(filter, missed));
    if (filter.missed && empty) {
      return note({
        title: "Nothing missed yet. Questions you get wrong will collect here.",
        actions: [{ label: "Practice all topics", onClick: () => (allTopics(), applyFilter({ topics: null, missed: false })) }],
      });
    }
    const names = (filter.topics ?? []).map((slug) => pool.topicBySlug.get(slug).name);
    const title = filter.topics
      ? `That's every card in ${names.length > 3 ? `these ${names.length} topics` : listPhrase(names)}.`
      : "That's every card you had missed.";
    return note({
      lead: "Nice work!",
      title,
      actions: [
        { label: "Shuffle and go again", onClick: () => deal(true) },
        { label: "Practice all topics", onClick: () => (allTopics(), applyFilter({ topics: null, missed: false })) },
        { label: "Take a Mock Test", href: testHref },
      ],
    });
  };

  /** One question as a card; its answer waits for the sheet. */
  const cardFor = (q) => {
    const node = cloneOne("tpl-card");
    const topic = pool.topicBySlug.get(q.topic);
    slot(node, "emoji").textContent = topic.emoji;
    slot(node, "topic").textContent = topic.name;
    const stemId = `card-stem-${q.k}-${dealt}`;
    const stem = slot(node, "stem");
    stem.id = stemId;
    stem.textContent = q.q;
    stem.tabIndex = -1;

    const holder = slot(node, "figure");
    if (q.media) {
      node.classList.add("qcard--media");
      const fig = figure(q, pool);
      holder.append(fig);
      fig.id = `${stemId}-figure`;
      stem.setAttribute("aria-describedby", `${fig.id}-caption`);
      slot(fig, "caption").id = `${fig.id}-caption`;
    } else {
      holder.remove();
    }

    const tiles = slot(node, "tiles");
    tiles.setAttribute("aria-labelledby", stemId);
    shuffledIds(q.choices).forEach((id, i) => {
      const tile = cloneOne("tpl-tile");
      tile.dataset.choice = id;
      tile.querySelector(".tile__key").textContent = LETTERS[i];
      slot(tile, "text").textContent = choiceText(q, id);
      tile.addEventListener("click", () => answer(id));
      tiles.append(tile);
    });
    return node;
  };

  /** The next card, or the end card. Focus follows a reader's own action, never a load. */
  function deal(reshuffle = false, focus = true) {
    if (reshuffle) {
      deck = shuffleDeck();
      syncPracticing();
    }
    if (!deck.length && !(filter.topics || filter.missed)) deck = shuffleDeck();
    if (!deck.length) {
      place(endCard(), { focus });
      return;
    }
    const q = pool.byKey.get(draw());
    dealt++;
    const node = cardFor(q);
    card = { q, node, done: false };
    place(node, { focus });
  }

  // ---- The answer sheet -----------------------------------------------------------------------------

  /** Fills the sheet for an answered card and raises it. */
  function openSheetFor(q, isRight) {
    const verdict = fillAnswer(sheet, q, pool, data.learn, isRight ? "right" : "wrong");
    sheet.getAnimations().forEach((a) => a.cancel());
    sheet.hidden = false;
    live.textContent = verdict;
  }

  /** Lowers the sheet as the next card deals. */
  function closeSheet() {
    if (!sheet || sheet.hidden) return;
    if (reducedMotion()) {
      sheet.hidden = true;
      return;
    }
    sheet.getAnimations().forEach((a) => a.cancel());
    sheet
      .animate([{ translate: "0 0", opacity: 1 }, { translate: "0 100%", opacity: 0 }], { duration: knob("--dur-next"), easing: "ease-in" })
      .finished.then(() => {
        if (!card?.done) sheet.hidden = true;
      })
      .catch(() => {});
  }

  // ---- The answer moment ----------------------------------------------------------------------------

  /** Fades out the choices neither picked nor right, then closes the card up around the rest. */
  async function fold(node, gone) {
    await Promise.all(
      gone.map((t) => t.animate([{ opacity: 1 }, { opacity: 0 }], { duration: knob("--dur-fold-fade"), easing: "ease-out", fill: "forwards" }).finished),
    ).catch(() => {});
    if (!node.isConnected || node.classList.contains("qcard--leaving")) return;
    const face = node.querySelector(".qcard__face");
    const kept = [...node.querySelectorAll(".tile")].filter((t) => !gone.includes(t));
    const before = face.offsetHeight;
    const tops = kept.map((t) => t.offsetTop);
    for (const t of gone) t.remove();
    if (reducedMotion()) return;
    const timing = { duration: knob("--dur-fold"), easing: "ease-out" };
    const after = face.offsetHeight;
    if (after !== before) face.animate([{ height: `${before}px` }, { height: `${after}px` }], timing);
    kept.forEach((t, i) => {
      const dy = tops[i] - t.offsetTop;
      if (dy) t.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], timing);
    });
  }

  function answer(id) {
    if (!card || card.done) return;
    const { q, node } = card;
    card.done = true;
    const isRight = id === q.answer;
    store.recordAnswer(data.cert, data.state, q.k, isRight, "c");

    const tiles = [...node.querySelectorAll(".tile")];
    for (const tile of tiles) tile.setAttribute("aria-disabled", "true");
    const chosen = tiles.find((t) => t.dataset.choice === id);
    const correct = tiles.find((t) => t.dataset.choice === q.answer);
    chosen.classList.add("tile--chosen");
    if (isRight) {
      markTile(chosen, "right", "Correct");
    } else {
      markTile(chosen, "wrong", "Your answer");
      markTile(correct, "right", "Correct answer");
    }
    node.dataset.result = isRight ? "right" : "wrong";
    stageEl.classList.add("cards__stage--quiet");
    fold(node, tiles.filter((t) => t !== chosen && t !== correct));

    openSheetFor(q, isRight);
    if (panel.contains(document.activeElement) || document.activeElement === document.body) {
      sheet.querySelector('[data-action="next"]').focus({ preventScroll: true });
    }
    syncFilters();
  }

  // ---- Keys: only while focus is inside the stage --------------------------------------------------

  panel.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.defaultPrevented) return;
    if (event.target.closest?.("input, select, textarea, .cards__side")) return;
    if (!card) return;
    const key = event.key.toLowerCase();
    if (!card.done) {
      const index = "abcd".indexOf(key) >= 0 ? "abcd".indexOf(key) : "1234".indexOf(key);
      const tile = index >= 0 ? card.node.querySelectorAll(".tile")[index] : null;
      if (tile) {
        event.preventDefault();
        tile.click();
      }
      return;
    }
    const onControl = event.target.closest?.("a, button");
    if (key === "arrowright" || (key === "enter" && !onControl)) {
      event.preventDefault();
      deal();
    }
  });

  // ---- The filter: the sidebar from 1248, the bar's sheet below. Both apply changes as they're made ----

  /** Shows the filter in force in a filter control, and the missed count as it stands. */
  function syncFilterUI(root) {
    if (!root) return;
    for (const box of root.querySelectorAll('input[name="topic"]')) box.checked = !filter.topics || filter.topics.includes(box.value);
    const count = missedCount();
    const switchBox = root.querySelector('input[name="missed"]');
    slot(root, "missed-row").hidden = !tracking();
    slot(root, "missed-count").textContent = String(count);
    switchBox.checked = filter.missed;
    switchBox.disabled = count === 0 && !filter.missed;
    slot(root, "missed-note").hidden = count > 0 || filter.missed;
    slot(root, "error").hidden = true;
  }

  const syncFilters = () => {
    syncFilterUI(side);
    syncFilterUI(dialog);
  };

  /** Reads a filter control into a filter; with no topic checked, the one in force stays. */
  function applyFrom(root) {
    const picked = [...root.querySelectorAll('input[name="topic"]:checked')].map((b) => b.value);
    slot(root, "error").hidden = picked.length > 0;
    if (!picked.length) return;
    const switchBox = root.querySelector('input[name="missed"]');
    const next = { topics: picked.length === pool.topics.length ? null : picked, missed: switchBox.checked && !switchBox.disabled };
    if (sameFilter(next, filter)) return;
    ctx.replaceUrl(urlFor(next));
    applyFilter(next, { focus: false, keep: true });
  }

  function wireFilter(root) {
    root.addEventListener("change", () => applyFrom(root));
    root.querySelector('[data-action="all"]').addEventListener("click", () => {
      for (const box of root.querySelectorAll('input[name="topic"]')) box.checked = true;
      applyFrom(root);
    });
    root.querySelector('[data-action="none"]').addEventListener("click", () => {
      for (const box of root.querySelectorAll('input[name="topic"]')) box.checked = false;
      applyFrom(root);
    });
  }

  filterButton.addEventListener("click", () => {
    if (!pool) return;
    syncFilterUI(dialog);
    openSheet(dialog);
  });
  wireFilter(dialog);

  /** Puts a filter in force with a fresh shuffle; with `keep`, a matching card on screen stays. */
  function applyFilter(next, { focus = true, keep = false } = {}) {
    filter = next;
    filterSummary.textContent = `, ${summary(filter)}`;
    syncFilters();
    syncPracticing();
    const missed = missedKeys(record().answers);
    const n = pool.questions.filter(matches(filter, missed)).length;
    if (keep && card && matches(filter, missed)(card.q)) {
      deck = shuffleDeck(card.q.k);
    } else {
      deck = shuffleDeck();
      deal(false, focus);
    }
    live.textContent = `${n} ${n === 1 ? "card" : "cards"}`;
  }

  // ---- Mounting ----------------------------------------------------------------------------------

  const render = (loaded) => {
    pool = loaded;
    panel.replaceChildren(clone("tpl-cards"));
    stageEl = panel.querySelector(".cards__stage");
    deckEl = slot(panel, "deck");
    live = slot(panel, "live");
    sheet = slot(panel, "answer");
    side = panel.querySelector(".cards__side");
    sheet.querySelector('[data-action="next"]').addEventListener("click", () => deal());
    watchSheetHeight(panel).observe(sheet);
    wireFilter(side);
    const url = new URL(location.href);
    filter = filterFrom(url);
    filterSummary.textContent = `, ${summary(filter)}`;
    syncFilters();
    syncPracticing();
    deck = shuffleDeck();
    deal(false, false);
  };

  const load = () =>
    ctx
      .pool()
      .then(render)
      .catch(() => {
        const status = panel.querySelector(".skeleton");
        status?.replaceChildren(cloneOne("tpl-load-error"));
        panel.querySelector('[data-action="retry"]')?.addEventListener("click", () => {
          status?.replaceChildren(Object.assign(document.createElement("div"), { className: "skeleton__card" }));
          load();
        });
      });
  const ready = load();

  return {
    ready,
    heading: () => panel.querySelector('[data-slot="heading"]'),
    enter(url) {
      ready.then(() => {
        if (!pool) return;
        const asked = filterFrom(url);
        if (!sameFilter(asked, filter)) applyFilter(asked, { focus: false });
      });
    },
  };
}
