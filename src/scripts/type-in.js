// Types an exhibit's text in character by character, over HTML that already holds all of it.

const PENDING = "type-in__char--pending";

// Milliseconds per character - the one knob for typing speed.
const CHAR_MS = 18;

// Caps one frame's catch-up, so typing resumes after a background tab rather than dumping the rest.
const MAX_FRAME_MS = 100;

// Watches the top of the viewport only, so an exhibit waits until it has risen into reading position.
const READING_POSITION = "0px 0px -25% 0px";

/** False for a reader who asked for no motion, or a browser that cannot watch for arrival. */
export const canType = () =>
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches && "IntersectionObserver" in window;

/** Runs `fn` once, when `el` first rises into reading position. */
export function onArrival(el, fn) {
  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      fn();
    },
    { rootMargin: READING_POSITION }
  );
  observer.observe(el);
}

/** Wraps each character in a pending span up front, walking text nodes so markup like .key-mark survives. */
export function splitChars(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  /** @type {Text[]} */
  const nodes = [];
  while (walker.nextNode()) nodes.push(/** @type {Text} */ (walker.currentNode));

  const chars = [];
  nodes.forEach((node, i) => {
    // Markup whitespace collapses to single spaces, so one span is one visible character.
    let text = node.nodeValue.replace(/\s+/g, " ");
    if (i === 0) text = text.trimStart();
    if (i === nodes.length - 1) text = text.trimEnd();
    if (!text) return;

    const frag = document.createDocumentFragment();
    for (const ch of text) {
      const span = document.createElement("span");
      span.className = PENDING;
      span.textContent = ch;
      frag.appendChild(span);
      chars.push(span);
    }
    node.parentNode.replaceChild(frag, node);
  });
  return chars;
}

/** Reveals `chars` one at a time, then calls `done`. */
function typeIn(chars, done) {
  let shown = 0;
  let last = performance.now();
  let owed = 0;

  const step = (now) => {
    owed += Math.min(now - last, MAX_FRAME_MS);
    last = now;
    // A while loop, so CHAR_MS can run faster than the frame rate.
    while (owed >= CHAR_MS && shown < chars.length) {
      chars[shown++].classList.remove(PENDING);
      owed -= CHAR_MS;
    }
    if (shown < chars.length) requestAnimationFrame(step);
    else done();
  };
  requestAnimationFrame(step);
}

/** Types `chars` in and calls `done` once; a timed net reveals everything if the loop dies partway. */
export function typeInSafely(chars, done) {
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimeout(net);
    for (const span of chars) span.classList.remove(PENDING);
    done();
  };
  const net = setTimeout(finish, chars.length * CHAR_MS + 3000);
  typeIn(chars, finish);
}
