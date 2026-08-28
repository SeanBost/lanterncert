// Types each quoted card in as it reaches reading position, then lights the key phrase.
// The full text ships in the HTML and is only re-revealed here, so every path without JS still reads.

const TYPED = "correction--typed";
const PENDING = "correction__char--pending";

// Milliseconds per character - the one knob for typing speed.
const CHAR_MS = 22;

// rAF stops in a background tab, so the first frame back carries the whole absence. Clamped, the
// typing resumes where it paused instead of dumping every remaining character at once.
const MAX_FRAME_MS = 100;

// Watches the top of the viewport only, so a card waits until it has risen into reading position.
const ROOT_MARGIN = "0px 0px -25% 0px";

/**
 * Wraps every character in a span, laid out up front so revealing one causes no reflow.
 * Walks text nodes rather than innerHTML, which is what keeps .correction__key intact.
 */
function splitChars(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  /** @type {Text[]} */
  const nodes = [];
  while (walker.nextNode()) nodes.push(/** @type {Text} */ (walker.currentNode));

  const chars = [];
  nodes.forEach((node, i) => {
    // The markup's newlines and indentation render as single spaces; collapsing them here keeps
    // one span to one visible character, so CHAR_MS means what it says.
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
    // A while loop, not one per frame: CHAR_MS below a frame's length would otherwise cap typing
    // at the refresh rate and quietly ignore the knob.
    while (owed >= CHAR_MS && shown < chars.length) {
      chars[shown++].classList.remove(PENDING);
      owed -= CHAR_MS;
    }
    if (shown < chars.length) requestAnimationFrame(step);
    else done();
  };
  requestAnimationFrame(step);
}

export function initCorrection() {
  const block = document.querySelector(".correction");
  if (!block) return;

  const panes = [...block.querySelectorAll(".correction__overview, .correction__quote")];
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Nothing to animate with, or a reader who asked for no motion: the text is already whole, so
  // only the glow needs releasing.
  if (reduced || !panes.length || !("IntersectionObserver" in window)) {
    block.classList.add(TYPED);
    return;
  }

  // Each card is its own unit: split, watched and typed independently, so one arriving never waits
  // on the other. The glow belongs to whichever card holds the key phrase.
  const cards = panes.map((pane) => ({
    pane,
    chars: splitChars(pane),
    lights: Boolean(pane.querySelector(".correction__key")),
    net: 0,
  }));

  const finish = (card) => {
    clearTimeout(card.net);
    for (const span of card.chars) span.classList.remove(PENDING);
    if (card.lights) block.classList.add(TYPED);
  };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        // One gesture, once - a card types on arrival, not on every scroll past.
        observer.unobserve(entry.target);
        const card = cards.find((c) => c.pane.closest(".correction__evidence") === entry.target);
        if (!card) continue;

        // Safety net, on the same principle as the state field's: the text is INVISIBLE until
        // revealed, so a loop that dies partway must not take the quote down with it.
        card.net = setTimeout(() => finish(card), card.chars.length * CHAR_MS + 3000);
        typeIn(card.chars, () => finish(card));
      }
    },
    { rootMargin: ROOT_MARGIN }
  );

  // Watching the figure rather than the pane, so a card counts as arrived once its label has too.
  for (const card of cards) observer.observe(card.pane.closest(".correction__evidence"));
}
