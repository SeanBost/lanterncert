// Browser-side behavior that belongs to EVERY page, imported once by Layout.astro. The other modules
// beside it are purpose-built and imported by the one component or page that needs them.
// Anything added here ships on all routes, so it earns its place by being small and cross-cutting.

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
