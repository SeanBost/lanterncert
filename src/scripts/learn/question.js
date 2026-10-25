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

/** Marks a choice right or wrong, with its glyph and a real text label. */
export function markTile(tile, kind, label) {
  tile.classList.add(kind === "right" ? "tile--right" : "tile--wrong");
  const verdict = slot(tile, "verdict");
  verdict.innerHTML = `${kind === "right" ? CHECK : CROSS}<span class="tile__label"></span>`;
  verdict.querySelector(".tile__label").textContent = label;
}

/** Fills an answer sheet (verdict, why, source, a phone's figure credit, guide link) for `kind` right, wrong or none; returns the verdict. */
export function fillAnswer(sheet, q, pool, learn, kind) {
  const text = choiceText(q, q.answer);
  const correct = `Correct answer: ${text}${/[.?!]$/.test(text) ? "" : "."}`;
  const verdict = kind === "right" ? "Correct." : `${kind === "wrong" ? "Not quite." : "Not answered."} ${correct}`;
  sheet.classList.toggle("answer--right", kind === "right");
  const line = slot(sheet, "verdict");
  line.innerHTML = kind === "right" ? CHECK : CROSS;
  line.append(Object.assign(document.createElement("span"), { textContent: verdict }));
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
