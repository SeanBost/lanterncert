// Browser-side behavior for EVERY page, imported once by Layout.astro.
// Anything added here ships on all routes, so it must be small and cross-cutting.

// Past this the page counts as scrolled. Low, so the chrome reacts to the first wheel notch.
const SCROLLED_PX = 4;

/** Publishes "the page has scrolled" on <html>, so CSS anywhere can key off it with [data-scrolled]. */
function initScrollState() {
  const root = document.documentElement;
  let queued = false;

  function apply() {
    root.toggleAttribute("data-scrolled", window.scrollY > SCROLLED_PX);
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

export function initGlobal() {
  initScrollState();
}
