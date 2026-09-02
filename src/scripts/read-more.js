// Moves focus into the text a one-way "continue reading" control just revealed, without scrolling.
// The control removes itself on open, so focus would otherwise fall back to the document.

export function initReadMore() {
  for (const details of document.querySelectorAll(".intro-more")) {
    details.addEventListener("toggle", () => {
      if (details.open) details.querySelector(".intro-more__body")?.focus({ preventScroll: true });
    });
  }
}
