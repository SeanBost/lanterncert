// Types the reply sheet's answer in as it reaches reading position, then marks the key phrase.
import { canType, onArrival, splitChars, typeInSafely } from "./type-in.js";

const TYPED = "reply-sheet--typed";

export function initReplySheet() {
  const sheet = document.querySelector(".reply-sheet");
  if (!sheet) return;

  const answer = sheet.querySelector("[data-type-in]");
  // With nothing to type, only the mark needs releasing.
  if (!canType() || !answer) {
    sheet.classList.add(TYPED);
    return;
  }

  const chars = splitChars(answer);
  onArrival(sheet, () => typeInSafely(chars, () => sheet.classList.add(TYPED)));
}
