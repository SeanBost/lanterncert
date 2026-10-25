// The arrival glow: an element reached by a jump lights up once the scroll to it has settled.

// Whichever comes first, scrollend or this. Set under a typical smooth scroll on purpose, so a long
// jump lights up as the entry arrives rather than after it stops, and a short one still waits.
const GLOW_DELAY_MS = 450;

/** Runs once the page has stopped scrolling, or on a timer where scrollend is unavailable. */
export function afterScroll(run) {
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

/** Restarts the glow class, so the same target glows again on a second jump. */
export function glow(element, className) {
  element.classList.remove(className);
  // Reading a layout property flushes the removal, so the re-add is seen as a change.
  void element.offsetWidth;
  element.classList.add(className);
  element.addEventListener("animationend", () => element.classList.remove(className), { once: true });
}
