// Glows the source a citation marker points at, once the jump to it has settled.
// The scroll itself is CSS: scroll-behavior and scroll-padding-top in global.css.
import { afterScroll, glow } from "./glow.js";

const HIT = "source-list__entry--hit";

/** @type {Element | null} A jump already waiting on its scroll, so one gesture glows once. */
let queued = null;

export function initCiteJump() {
  const list = document.querySelector(".source-list");
  if (!list) return;

  /** @param {string | null | undefined} hash */
  const jumpTo = (hash) => {
    const id = hash?.startsWith("#") ? hash.slice(1) : null;
    const entry = id && list.querySelector(`li[id="${CSS.escape(id)}"]`);
    // A click also fires hashchange, so the guard is what keeps one jump to one glow.
    if (!entry || queued === entry) return;
    queued = entry;
    afterScroll(() => {
      queued = null;
      glow(entry, HIT);
    });
  };

  // Delegated, so the handler is one listener rather than one per marker. The default jump is left
  // alone: it does the scrolling and puts the source in the URL.
  document.addEventListener("click", (event) => {
    const link = event.target.closest?.("a.cite");
    if (link) jumpTo(link.getAttribute("href"));
  });

  // Back and forward move between citations without a click, and land silently without this.
  window.addEventListener("hashchange", () => jumpTo(location.hash));
}
