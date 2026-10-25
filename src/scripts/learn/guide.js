// Study Guide mode. The guide is static HTML showing one topic at a time; this switches topics by hash,
// opens the Topics sheet, and glows a line reached from elsewhere in the tool.
import { afterScroll, glow } from "../glow.js";
import { initCiteJump } from "../cite-jump.js";
import { openSheet } from "./dialog.js";

const HIT = "guide-fact--hit";

export function mount(ctx) {
  const { panel, data } = ctx;
  initCiteJump();

  const sections = [...panel.querySelectorAll(".guide-topic")];
  const sources = [...panel.querySelectorAll(".guide-sources li[data-topics]")];
  const links = [...document.querySelectorAll(".guide-index__link")];
  const practice = panel.querySelector("[data-practice-topic]");
  let current = sections.find((s) => !s.hidden) ?? sections[0];

  /** Shows one page and the sources it cites, marks it in both indexes, and aims the practice button at a topic. */
  const show = (section) => {
    current = section;
    if (!section.classList.contains("guide-topic--overview")) {
      practice?.setAttribute("href", `${data.learn}?mode=cards&topics=${section.id}`);
      const emoji = practice?.querySelector('[data-slot="emoji"]');
      if (emoji) emoji.textContent = section.querySelector(".guide-topic__title [aria-hidden]")?.textContent ?? "";
    }
    for (const s of sections) s.hidden = s !== section;
    for (const li of sources) li.hidden = !li.dataset.topics.split(" ").includes(section.id);
    for (const link of links) {
      if (link.dataset.topic === section.id) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
  };
  show(current);

  /** The topic a target lives in; a source stays on the current topic when that topic cites it. */
  const topicOf = (target) => {
    const own = target.closest(".guide-topic");
    if (own) return own;
    const citing = target.dataset.topics?.split(" ");
    if (!citing) return null;
    return citing.includes(current.id) ? current : document.getElementById(citing[0]);
  };

  /** Lands on a hash: shows its topic, brings the target in, and glows a line. */
  const arrive = (hash, { focus }) => {
    const id = decodeURIComponent(hash.slice(1));
    const target = id && document.getElementById(id);
    if (!target || !panel.contains(target)) return;
    const topic = topicOf(target);
    const changed = topic && topic !== current;
    if (changed) show(topic);
    if (target === topic) {
      // Arriving at a page lands at its top.
      window.scrollTo({ top: 0, behavior: "instant" });
      // The overview's heading is the page's h1.
      if (focus) (target.querySelector(".guide-topic__title") ?? document.getElementById("guide-title"))?.focus({ preventScroll: true });
    } else if (target.classList.contains("guide-fact")) {
      target.scrollIntoView({ block: "center", behavior: "instant" });
      afterScroll(() => glow(target, HIT));
    } else if (changed) {
      target.scrollIntoView({ block: "start", behavior: "instant" });
    }
  };
  // Back to the guide's bare URL is back to the overview.
  window.addEventListener("hashchange", () => {
    if (!ctx.isActive()) return;
    if (location.hash) arrive(location.hash, { focus: true });
    else if (current !== sections[0]) arrive(`#${sections[0].id}`, { focus: true });
  });

  // ---- The Topics sheet --------------------------------------------------------------------------

  const sheet = /** @type {HTMLDialogElement} */ (document.getElementById("guide-index-sheet"));
  const topicsButton = ctx.tools.querySelector('[data-action="topics"]');
  topicsButton.addEventListener("click", () => openSheet(sheet));
  // A topic picked in the sheet closes it; the hash change does the rest, or this does when it's unchanged.
  sheet.addEventListener("click", (event) => {
    const link = event.target.closest?.("a[href^='#']");
    if (!link) return;
    sheet.close();
    const hash = link.getAttribute("href");
    if (hash === location.hash) requestAnimationFrame(() => arrive(hash, { focus: true }));
  });

  return {
    heading: () => document.getElementById("guide-title"),
    enter(url, { initial }) {
      if (url.hash) arrive(url.hash, { focus: !initial });
    },
  };
}
