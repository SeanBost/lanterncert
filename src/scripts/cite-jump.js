// Glows the source a citation marker points at, once the jump to it has settled.
// The scroll itself is CSS: scroll-behavior and scroll-padding-top in global.css.

// Whichever comes first, scrollend or this. Set under a typical smooth scroll on purpose, so a long
// jump lights up as the entry arrives rather than after it stops, and a short one still waits.
const GLOW_DELAY_MS = 450;
const HIT = "source-list__entry--hit";

/** @type {Element | null} A jump already waiting on its scroll, so one gesture glows once. */
let queued = null;

/** Restarts the animation when the same citation is clicked twice - a class already present does nothing. */
function glow(entry) {
  entry.classList.remove(HIT);
  // Reading a layout property flushes the removal, so the re-add is seen as a change.
  void entry.offsetWidth;
  entry.classList.add(HIT);
}

/** Runs once the page has stopped scrolling, or on a timer where scrollend is unavailable. */
function afterScroll(run) {
  if (!("onscrollend" in window)) {
    setTimeout(run, GLOW_DELAY_MS);
    return;
  }
  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    window.removeEventListener("scrollend", finish);
    run();
  };
  // A target already in view scrolls nowhere and fires no scrollend, so the timer is also the cap.
  const timer = setTimeout(finish, GLOW_DELAY_MS);
  window.addEventListener("scrollend", finish);
}

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
      glow(entry);
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

  list.addEventListener("animationend", (event) => {
    if (event.animationName === "source-hit") event.target.classList.remove(HIT);
  });
}
