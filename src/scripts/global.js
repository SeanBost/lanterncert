// Browser-side behavior for EVERY page, imported once by Layout.astro.
// Anything added here ships on all routes, so it must be small and cross-cutting.

// Past this the page counts as scrolled. Low, so the chrome reacts to the first wheel notch.
const SCROLLED_PX = 4;

/** Publishes "the page has scrolled" on <html>, so CSS anywhere can key off it with [data-scrolled]. */
function initScrollState() {
  const root = document.documentElement;
  let queued = false;

  // data-at-top is asserted positively rather than read as :not([data-scrolled]): with no script
  // neither attribute lands, so the chrome keeps the opaque band instead of going see-through.
  function apply() {
    const scrolled = window.scrollY > SCROLLED_PX;
    root.toggleAttribute("data-scrolled", scrolled);
    root.toggleAttribute("data-at-top", !scrolled);
    queued = false;
  }

  // Set before the first scroll event, or a page restored mid-document starts out unflagged.
  apply();

  window.addEventListener(
    "scroll",
    () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(apply);
    },
    { passive: true },
  );
}

/** Publishes "the load is over" on <html>, which is what arms scroll-behavior: smooth in global.css. */
function initScrollSettled() {
  const arm = () => document.documentElement.setAttribute("data-scroll-settled", "");
  if (document.readyState === "complete") arm();
  else window.addEventListener("load", arm, { once: true });
}

/** Publishes the rendering engine on <html>, which global.css's engine fallback block keys off. */
function initEngine() {
  // "Gecko/<digits>" is Firefox alone - Blink and WebKit both say "like Gecko" with no version.
  if (/Gecko\/\d/.test(navigator.userAgent)) {
    document.documentElement.setAttribute("data-engine", "gecko");
  }
}

export function initGlobal() {
  initEngine();
  initScrollState();
  initScrollSettled();
}
