// Practice Cards mode: one card at a time from a shuffled deck that ends on an end card, untimed, with no counter anywhere.
// An answer opens in a sheet docked at the stage's foot. Answers write to the store as mode "c".
import { openSheet } from "./dialog.js";
import {
  LETTERS,
  choiceText,
  clone,
  cloneOne,
  figure,
  fillAnswer,
  fitSheet,
  knob,
  listPhrase,
  markTile,
  reducedMotion,
  setKey,
  setKeysRange,
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
  /** The stage and the sheet's grid. */
  let mainEl = null;
  let side = null;
  /** The filter in force: null topics means all of them. */
  let filter = { topics: null, missed: false };
  let deck = [];
  /** Cards dealt so far, part of each card's ids. */
  let dealt = 0;
  let card = null;
  /** This pass through the deck: cards answered, and how many right. */
  let pass = { seen: 0, right: 0 };

  const tracking = () => store.status().tracking;
  const record = () => store.stateRecord(data.cert, data.state);
  const missedCount = () => [...missedKeys(record().answers)].filter((k) => pool.byKey.has(k)).length;

  // ---- The filter ---------------------------------------------------------------------------------

  /** The filter a URL asks for; unknown topics are dropped silently. */
  const filterFrom = (url) => {
    const asked = (url.searchParams.get("topics") ?? "").split(",").filter((slug) => pool.topicBySlug.has(slug));
    const topics = asked.length && asked.length < pool.topics.length ? [...new Set(asked)] : null;
    return { topics, missed: url.searchParams.has("missed") && tracking() };
  };

  const sameFilter = (a, b) => a.missed === b.missed && String(a.topics) === String(b.topics);

  /** Written out by hand: the topic list's commas plain, the missed filter a bare flag. */
  const urlFor = (f) => {
    const query = ["mode=cards"];
    if (f.topics) query.push(`topics=${f.topics.join(",")}`);
    if (f.missed) query.push("missed");
    return `${new URL(data.learn, location.href).pathname}?${query.join("&")}`;
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

  /** The pile's tilts in degrees, as learn.css starts them: the sheet under the card, and the one under that. */
  let tilt = { near: 0.9, far: -1.7 };

  /** Deals the pile fresh tilts: the near sheet always turned a little clockwise, the far one further the other way. */
  const retilt = () => {
    const near = 0.7 + Math.random() * 0.4;
    const far = -(1.4 + Math.random() * 0.6);
    tilt = { near, far };
    deckEl.style.setProperty("--tilt-near", `${near.toFixed(2)}deg`);
    deckEl.style.setProperty("--tilt-far", `${far.toFixed(2)}deg`);
  };

  /** Eases the pile from the tossed card's height to the new card's; once done, the pile follows the card again. */
  const settlePile = (from, to) => {
    if (reducedMotion() || from === to) return;
    deckEl.animate([{ "--pile-h": `${from}px` }, { "--pile-h": `${to}px` }], { duration: knob("--dur-settle"), easing: "cubic-bezier(0.22, 1, 0.36, 1)" });
  };

  /** Swaps the card on the pile: the old one is tossed off, the new one comes up from the sheet beneath and straightens. */
  const place = async (node, { focus = true } = {}) => {
    const old = deckEl.querySelector(".qcard:not(.qcard--leaving)");
    const oldHeight = old?.querySelector(".qcard__face").offsetHeight;
    deckEl.append(node);
    stageEl.classList.toggle("cards__stage--quiet", !card);
    if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: "instant" });
    const enter = node.querySelector(".qcard__stem, .qcard__note-title");
    if (focus) enter?.focus({ preventScroll: true });
    closeSheet();
    if (!old) return;
    old.classList.add("qcard--leaving");
    old.setAttribute("inert", "");
    const from = tilt.near * (parseFloat(getComputedStyle(deckEl).getPropertyValue("--pile-k")) || 1);
    if (!reducedMotion()) retilt();
    settlePile(oldHeight, node.querySelector(".qcard__face").offsetHeight);
    const ms = reducedMotion() ? knob("--dur-fade") : knob("--dur-next");
    const out = reducedMotion()
      ? [{ opacity: 1 }, { opacity: 0 }]
      : [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translate(-4rem, 0.5rem) rotate(-6deg)" }];
    const into = reducedMotion()
      ? [{ opacity: 0 }, { opacity: 1 }]
      : [{ opacity: 0, transform: `translateY(0.5rem) rotate(${from}deg) scale(0.99)` }, { opacity: 1, transform: "none" }];
    node.animate(into, { duration: ms * 1.4, easing: "cubic-bezier(0.22, 1, 0.36, 1)" });
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

  /** The end of a pass: a lead by how it went, what it covered, and the way on; at the pass mark the Mock Test leads. */
  const endCard = () => {
    const missed = missedKeys(record().answers);
    const still = pool.questions.filter(matches({ topics: filter.topics, missed: true }, missed)).length;
    const allTopicsAction = { label: "Practice all topics", onClick: () => (allTopics(), applyFilter({ topics: null, missed: false })) };
    if (filter.missed && !still && !pass.seen) {
      return note({ title: "Nothing missed yet. Questions you get wrong will collect here.", actions: [allTopicsAction] });
    }
    const names = (filter.topics ?? []).map((slug) => pool.topicBySlug.get(slug).name);
    const scope = names.length > 3 ? `these ${names.length} topics` : listPhrase(names);
    const testAction = { label: "Take a Mock Test", href: testHref };
    // A missed-only pass that leaves nothing missed has cleared them all.
    if (filter.missed && !still) {
      return note({
        lead: "Nice work!",
        title: filter.topics ? `You cleared every missed card in ${scope}.` : "You cleared every card you had missed.",
        actions: [testAction, allTopicsAction],
      });
    }
    const retry = { topics: filter.topics, missed: true };
    const missedAction = still && {
      label: still === 1 ? "Practice the one you missed" : `Practice the ${still} you missed`,
      onClick: () => (ctx.replaceUrl(urlFor(retry)), applyFilter(retry)),
    };
    // A missed-only pass goes again by practicing the ones still missed.
    const again = filter.missed ? [missedAction] : [missedAction, { label: "Shuffle and go again", onClick: () => deal(true) }];
    const wider = filter.topics || filter.missed ? [allTopicsAction] : [];
    const passed = pass.right * 100 >= data.format.pass * pass.seen;
    const title = filter.missed
      ? filter.topics ? `That's every missed card in ${scope}.` : "That's every card you had missed."
      : filter.topics ? `That's every card in ${scope}.` : "That's every card.";
    return note({
      lead: passed ? "Nice work!" : "Keep at it!",
      title,
      actions: (passed ? [testAction, ...again, ...wider] : [...again, ...wider, testAction]).filter(Boolean),
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
      setKey(tile.querySelector(".tile__key"), LETTERS[i]);
      slot(tile, "text").textContent = choiceText(q, id);
      tile.addEventListener("click", () => answer(id, "press"));
      tiles.append(tile);
    });
    return node;
  };

  /** Shows how many cards the deck has left under the one on top, at most two. */
  const pileLeft = () => {
    deckEl.dataset.left = String(Math.min(deck.length, 2));
  };

  /** The next card, or the end card. Focus follows a reader's own action, never a load. */
  function deal(reshuffle = false, focus = true) {
    if (reshuffle) {
      deck = shuffleDeck();
      pass = { seen: 0, right: 0 };
      syncPracticing();
    }
    if (!deck.length) {
      pileLeft();
      place(endCard(), { focus });
      return;
    }
    const q = pool.byKey.get(draw());
    pileLeft();
    dealt++;
    const node = cardFor(q);
    setKeysRange(stageEl, q.choices.length);
    card = { q, node, done: false };
    place(node, { focus });
  }

  // ---- The answer sheet -----------------------------------------------------------------------------

  /** Raises the filled sheet over the card's foot, clear of its question; with `takeFocus`, focus moves to Next card unless the reader has moved it elsewhere. */
  function raiseSheet(takeFocus) {
    sheet.getAnimations().forEach((a) => a.cancel());
    sheet.hidden = false;
    fitSheet(mainEl, card.node, sheet, { reveal: true });
    if (takeFocus && (panel.contains(document.activeElement) || document.activeElement === document.body)) {
      sheet.querySelector('[data-action="next"]').focus({ preventScroll: true });
    }
  }

  /** Lowers the sheet as the next card deals, the room it took given up at once. */
  function closeSheet() {
    if (!sheet || sheet.hidden) return;
    mainEl.style.removeProperty("--answer-room");
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

  /** Fades out the choices neither picked nor right, then closes the card up around the rest; settles once it has. */
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
    const moves = [];
    if (after !== before) moves.push(face.animate([{ height: `${before}px` }, { height: `${after}px` }], timing).finished);
    kept.forEach((t, i) => {
      const dy = tops[i] - t.offsetTop;
      if (dy) moves.push(t.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], timing).finished);
    });
    await Promise.all(moves).catch(() => {});
  }

  /** Answers the card on screen; `via` is "press" for a tap, click or a focused tile's Enter, "shortcut" for A-D or 1-4. */
  function answer(id, via) {
    if (!card || card.done) return;
    const { q, node } = card;
    card.done = true;
    const isRight = id === q.answer;
    store.recordAnswer(data.cert, data.state, q.k, isRight, "c");
    pass.seen++;
    if (isRight) pass.right++;

    // Spent choices leave the Tab order.
    const tiles = [...node.querySelectorAll(".tile")];
    for (const tile of tiles) {
      tile.setAttribute("aria-disabled", "true");
      tile.tabIndex = -1;
    }
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
    // The pile shrinks with the card as it folds, even if it was still settling from the last toss.
    deckEl.getAnimations().forEach((a) => a.cancel());

    // The verdict is spoken at once; the sheet opens once the card has folded.
    live.textContent = fillAnswer(sheet, q, pool, data.learn, isRight ? "right" : "wrong", { praise: true });
    const gone = tiles.filter((t) => t !== chosen && t !== correct);
    // A shortcut leaves focus on the question; a press moves it to Next card once the sheet opens.
    const shortcut = via === "shortcut";
    if (shortcut && tiles.includes(document.activeElement)) node.querySelector(".qcard__stem").focus({ preventScroll: true });
    else if (gone.includes(document.activeElement)) chosen.focus({ preventScroll: true });
    fold(node, gone).then(() => {
      if (card?.node === node) raiseSheet(!shortcut);
    });
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
        answer(tile.dataset.choice, "shortcut");
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

  /** Shows the filter in force in a filter control; the missed switch shows once something is missed, or while it is on. */
  function syncFilterUI(root) {
    if (!root) return;
    for (const box of root.querySelectorAll('input[name="topic"]')) box.checked = !filter.topics || filter.topics.includes(box.value);
    const count = missedCount();
    slot(root, "missed-row").hidden = !tracking() || (count === 0 && !filter.missed);
    slot(root, "missed-count").textContent = String(count);
    root.querySelector('input[name="missed"]').checked = filter.missed;
    slot(root, "error").textContent = "";
  }

  const syncFilters = () => {
    syncFilterUI(side);
    syncFilterUI(dialog);
  };

  /** Reads a filter control into a filter; with no topic checked, the one in force stays. */
  function applyFrom(root) {
    const picked = [...root.querySelectorAll('input[name="topic"]:checked')].map((b) => b.value);
    slot(root, "error").textContent = picked.length ? "" : "Pick at least one topic";
    if (!picked.length) return;
    const missed = root.querySelector('input[name="missed"]').checked;
    const next = { topics: picked.length === pool.topics.length ? null : picked, missed };
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
      // An answered card that stays on screen counts toward the new pass.
      pass = card.done ? { seen: 1, right: Number(card.node.dataset.result === "right") } : { seen: 0, right: 0 };
      pileLeft();
    } else {
      pass = { seen: 0, right: 0 };
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
    mainEl = panel.querySelector(".cards__main");
    side = panel.querySelector(".cards__side");
    sheet.querySelector('[data-action="next"]').addEventListener("click", () => deal());
    watchSheetHeight(panel).observe(sheet);
    // A resized window or text size refits an open sheet around the question.
    new ResizeObserver(() => {
      if (card?.done && !sheet.hidden) fitSheet(mainEl, card.node, sheet);
    }).observe(sheet);
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
