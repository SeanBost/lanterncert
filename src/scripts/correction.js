// Types each quoted card in as it reaches reading position, then marks the key phrase.
import { canType, onArrival, splitChars, typeInSafely } from "./type-in.js";

const TYPED = "correction--typed";

export function initCorrection() {
  const block = document.querySelector(".correction");
  if (!block) return;

  const panes = [...block.querySelectorAll(".correction__overview, .correction__quote")];
  // With nothing to type, only the mark needs releasing.
  if (!canType() || !panes.length) {
    block.classList.add(TYPED);
    return;
  }

  // Each card types on its own arrival, watched by its figure so the label counts too.
  for (const pane of panes) {
    const chars = splitChars(pane);
    const marks = Boolean(pane.querySelector(".key-mark"));
    onArrival(pane.closest(".correction__evidence"), () =>
      typeInSafely(chars, () => {
        if (marks) block.classList.add(TYPED);
      })
    );
  }
}
