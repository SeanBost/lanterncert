// One question's pieces, shared by Practice Cards, the Mock Test and its review: the figure, the
// source line and the marks on a choice. Markup comes from the page's templates.
import { formatDate } from "../../lib/format-fact.js";

export const LETTERS = ["A", "B", "C", "D", "E", "F"];

/** A template's contents, cloned. */
export function clone(id) {
  return /** @type {HTMLTemplateElement} */ (document.getElementById(id)).content.cloneNode(true);
}

/** The first element of a template, cloned. */
export function cloneOne(id) {
  return /** @type {HTMLElement} */ (clone(id).firstElementChild);
}

/** The element marked data-slot="name" inside root. */
export function slot(root, name) {
  return root.querySelector(`[data-slot="${name}"]`);
}

/** Choice ids in a fresh random order. Never seeded: the order shown is stored where it matters. */
export function shuffledIds(choices) {
  const ids = choices.map((c) => c.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}

export function choiceText(q, id) {
  return q.choices.find((c) => c.id === id)?.text ?? "";
}

/** The question's image in its frame, or null. */
export function figure(q, pool) {
  const media = q.media;
  if (!media) return null;
  const node = cloneOne("tpl-figure");
  node.dataset.shape = media.w === media.h ? "square" : "wide";
  if (!media.needed) node.classList.add("q-figure--aside");
  const img = /** @type {HTMLImageElement} */ (slot(node, "img"));
  Object.assign(img, { src: media.src, alt: media.alt, width: media.w, height: media.h });
  const caption = slot(node, "caption");
  const credit = media.credit == null ? null : pool.sources[media.credit];
  if (credit) {
    const link = document.createElement("a");
    Object.assign(link, { href: credit.url, target: "_blank", rel: "noopener noreferrer", textContent: credit.title });
    caption.append("From the ", link);
  } else {
    caption.textContent = "Diagram: LanternCert";
  }
  return node;
}

/** "Source: {title}", its section and the date it was last read back. */
export function sourceLine(q, pool) {
  const node = cloneOne("tpl-source");
  const source = pool.sources[q.src];
  const link = /** @type {HTMLAnchorElement} */ (slot(node, "link"));
  link.href = source.url;
  link.textContent = source.title;
  const section = slot(node, "section");
  if (q.section) section.textContent = q.section;
  else section.remove();
  slot(node, "verified").textContent = `Last verified ${formatDate(q.verified)}`;
  return node;
}

export const CHECK =
  '<svg class="mark mark--check" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 4.5"/></svg>';
export const CROSS =
  '<svg class="mark mark--cross" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>';

/** The answer sheet's marks, as a grader's pen draws them: a tick glinting with two sparkles, or a cross. Each stroke has unit length, to draw in. */
const PEN_TICK =
  '<svg class="pen" viewBox="0 0 40 40" aria-hidden="true"><path class="pen__stroke" pathLength="1" d="M6 21C8.1 25.1 11.1 28.5 15 31C18.68 22.28 24.11 14.94 31.24 8.93"/><path class="pen__spark" d="M38.26-3.07Q39.34 1.85 44.26 2.93Q39.34 4.01 38.26 8.93Q37.18 4.01 32.26 2.93Q37.18 1.85 38.26-3.07Z"/><path class="pen__spark pen__spark--small" d="M30.16-7.27Q30.77-4.48 33.56-3.87Q30.77-3.26 30.16-.47Q29.55-3.26 26.76-3.87Q29.55-4.48 30.16-7.27Z"/></svg>';
const PEN_CROSS =
  '<svg class="pen pen--cross" viewBox="0 0 40 40" aria-hidden="true"><path class="pen__stroke" pathLength="1" d="M9.5 8.5C17 14.8 23.5 22 29 30"/><path class="pen__stroke" pathLength="1" d="M30 8C24.4 16.3 17.9 23.8 10.5 30.5"/></svg>';

/** The choice letters as a pen draws them, and the loop that circles a Mock Test pick. A letter with no drawing is plain text. */
const PEN_LETTERS = {
  A: "M7.2 18.4C8.8 14 10.6 9.6 12.7 5.5M12.1 6.1C13.9 9.8 15.5 13.6 16.9 17.7M8.5 13.9C11 13.4 13.6 13.2 16.2 13.1",
  B: "M8.6 5.8C8.4 10 8.1 14.2 7.9 18.4M8.3 6C11 5.4 14.8 5.9 14.6 8.6C14.4 11 11.2 11.7 7.6 11.8C11.4 11.5 16.6 12.2 16.2 15.3C15.8 18.4 11 18.5 7.4 18.2",
  C: "M16.9 8.1C15.8 6.1 13.6 5.3 11.6 5.6C8.5 6.1 6.8 9.2 7.1 12.6C7.4 16 9.8 18.5 12.7 18.3C14.5 18.2 15.9 17.2 16.9 15.6",
  D: "M8.7 5.7C8.5 9.9 8.3 14.1 8 18.4M8.4 5.9C11.4 5.4 15 6.2 16.3 9.2C17.5 12 16.8 15.6 14.5 17.3C12.6 18.7 9.8 18.7 7.3 18.3",
  E: "M8.6 5.8C8.4 10 8.2 14.2 8 18.4M8.1 6C10.8 5.6 13.6 5.5 16.4 5.8M8.4 12.1C10.4 11.8 12.5 11.7 14.7 11.9M7.7 18.3C10.6 18.6 13.5 18.5 16.7 18",
  F: "M8.6 5.8C8.4 10 8.2 14.2 8 18.4M8.1 6C10.8 5.6 13.6 5.5 16.4 5.8M8.4 12.1C10.4 11.8 12.5 11.7 14.7 11.9",
};
const PEN_LOOP = "M19.4 1.2C17.4.1 14.7-.4 12-.4C4.9-.4-.8 5.2-.8 12C-.8 18.9 4.9 24.4 12 24.4C19.1 24.4 24.8 18.9 24.8 12C24.8 7 22.2 3.4 18.6 1.6C15.8.3 11.2.2 7.8 1.4";

/** Sets the keys caption to a question's own range of letters and numbers. */
export function setKeysRange(root, count) {
  const last = slot(root, "keys-last");
  if (last) last.textContent = LETTERS[count - 1];
  const number = slot(root, "keys-count");
  if (number) number.textContent = String(count);
}

/** Fills a choice's key with its letter, pen-drawn where one is drawn. */
export function setKey(key, letter) {
  const d = PEN_LETTERS[letter];
  if (!d) {
    key.textContent = letter;
    return;
  }
  key.innerHTML = `<svg class="pen-letter" viewBox="0 0 24 24"><path d="${d}"/><path class="pen-letter__loop" pathLength="1" d="${PEN_LOOP}"/></svg>`;
}

/** Marks a choice right or wrong, with its glyph and a real text label. */
export function markTile(tile, kind, label) {
  tile.classList.add(kind === "right" ? "tile--right" : "tile--wrong");
  const verdict = slot(tile, "verdict");
  verdict.innerHTML = `${kind === "right" ? CHECK : CROSS}<span class="tile__label"></span>`;
  verdict.querySelector(".tile__label").textContent = label;
}

/** The words for a right answer in Practice Cards, one picked per answer. */
const PRAISE = ["Correct.", "That's right.", "Exactly right.", "Well done."];

/** Fills an answer sheet (verdict, why, source, a phone's figure credit, guide link) for `kind` right, wrong or none; returns the verdict. */
export function fillAnswer(sheet, q, pool, learn, kind, { praise = false } = {}) {
  const text = choiceText(q, q.answer);
  const correct = `Correct answer: ${text}${/[.?!]$/.test(text) ? "" : "."}`;
  const head = kind === "right"
    ? (praise ? PRAISE[Math.floor(Math.random() * PRAISE.length)] : "Correct.")
    : kind === "wrong" ? "Not quite." : "Not answered.";
  const verdict = kind === "right" ? head : `${head} ${correct}`;
  sheet.classList.toggle("answer--right", kind === "right");
  sheet.classList.toggle("answer--wrong", kind === "wrong");
  const line = slot(sheet, "verdict");
  line.innerHTML = `<span class="answer__badge">${kind === "right" ? PEN_TICK : PEN_CROSS}</span><span class="answer__words"><strong class="answer__head"></strong></span>`;
  line.querySelector(".answer__head").textContent = head;
  if (kind !== "right") {
    line.querySelector(".answer__words").append(Object.assign(document.createElement("span"), { className: "answer__rest", textContent: correct }));
  }
  slot(sheet, "why").textContent = q.why;
  slot(sheet, "source").replaceChildren(sourceLine(q, pool));
  slot(sheet, "guide-link").setAttribute("href", guideHref(learn, q));

  const credit = slot(sheet, "credit");
  const sameDocument = q.media?.credit != null && q.media.credit === q.src;
  const holder = q.media && !sameDocument ? (q.media.credit == null ? null : pool.sources[q.media.credit]) : undefined;
  credit.hidden = holder === undefined;
  if (holder) {
    const link = Object.assign(document.createElement("a"), { href: holder.url, target: "_blank", rel: "noopener noreferrer", textContent: holder.title });
    credit.replaceChildren("Image from the ", link);
  } else if (holder === null) {
    credit.textContent = "Diagram: LanternCert";
  }
  return verdict;
}

/** Publishes a sheet's height, with its gap below, as --answer-h on the panel holding it. */
export function watchSheetHeight(panel) {
  return new ResizeObserver(([entry]) => {
    const sheet = /** @type {HTMLElement} */ (entry.target);
    const gap = sheet.offsetHeight ? parseFloat(getComputedStyle(sheet).marginBottom) || 0 : 0;
    panel.style.setProperty("--answer-h", `${sheet.offsetHeight + gap}px`);
  });
}

/** Lets an open answer sheet cover a card's choices, never its question: the cell grows just enough (--answer-room), the sheet names a right answer it covers, and `reveal` scrolls the question clear where the page must scroll. */
export function fitSheet(cell, card, sheet, { reveal = false } = {}) {
  if (sheet.hidden || !card?.isConnected) {
    cell.style.removeProperty("--answer-room");
    return;
  }
  const top = cell.getBoundingClientRect().top;
  const below = (el) => el.getBoundingClientRect().bottom - top;
  const gap = parseFloat(getComputedStyle(card.querySelector(".qcard__face")).rowGap) || 0;
  const foot = parseFloat(getComputedStyle(sheet).marginBottom) || 0;
  const stem = card.querySelector(".qcard__stem");
  const place = () => cell.style.setProperty("--answer-room", `${below(stem) + gap + sheet.offsetHeight + foot}px`);
  sheet.classList.remove("answer--covering");
  place();
  const right = card.querySelector(".tile--right");
  if (right && below(right) > cell.offsetHeight - foot - sheet.offsetHeight) {
    sheet.classList.add("answer--covering");
    place();
  }
  const root = document.documentElement;
  const over = root.scrollHeight - root.clientHeight;
  if (reveal && over > window.scrollY) window.scrollTo({ top: over, behavior: reducedMotion() ? "instant" : "smooth" });
}

/** The guide line a question links to: its own, or its sister's. */
export function guideHref(learn, q) {
  return q.guide ? `${learn}?mode=guide#fact-${q.guide}` : `${learn}?mode=guide#${q.topic}`;
}

/** "A", "A and B", or "A, B, and C": a list as a reader says it. */
export function listPhrase(items) {
  if (items.length <= 2) return items.join(" and ");
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A duration knob from learn.css's :root, in milliseconds. */
export function knob(name) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value.endsWith("ms") ? parseFloat(value) : parseFloat(value) * 1000 || 0;
}

/** Scrolls an element's top out from under the sticky chrome, if it is there. */
export function bringIntoView(element) {
  const chrome = document.querySelector(".tool-bar")?.getBoundingClientRect().bottom ?? 0;
  if (element.getBoundingClientRect().top < chrome) element.scrollIntoView({ block: "start", behavior: "instant" });
}
