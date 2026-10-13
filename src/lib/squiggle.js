// Wireframe handwriting for text an exhibit leaves out: the caller places the words, a seed draws the strokes.

// One viewBox unit is one pixel at body size.
const HEIGHT = 16;
const BASELINE = 11.5;

/** mulberry32: a seeded PRNG, so a seed always yields the same strokes. */
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * One line of scribbled words: humps at x-height, the odd ascender, the odd dip below the line.
 * @param {number} seed
 * @param {[number, number][]} words each word's start and end, in viewBox units
 * @returns {{ d: string, viewBox: string }} the path and the viewBox it fills
 */
export function squiggleLine(seed, words) {
  const rand = seeded(seed);
  const between = (lo, hi) => lo + rand() * (hi - lo);
  const fixed = (n) => Number(n.toFixed(1));
  const parts = [];
  for (const [start, end] of words) {
    // Hump widths drawn past the span, then scaled to fill it exactly.
    const widths = [];
    let total = 0;
    while (total < end - start) {
      widths.push(between(10, 16));
      total += widths.at(-1);
    }
    let x = start;
    parts.push(`M${fixed(x)} ${BASELINE}`);
    for (const raw of widths) {
      const w = (raw * (end - start)) / total;
      const roll = rand();
      const peak = roll < 0.12 ? -3 : roll > 0.86 ? between(8.5, 10) : between(4, 5.5);
      parts.push(`Q${fixed(x + w / 2)} ${fixed(BASELINE - 2 * peak)} ${fixed(x + w)} ${BASELINE}`);
      x += w;
    }
  }
  return { d: parts.join(""), viewBox: `0 0 ${Math.ceil(words.at(-1)[1]) + 1} ${HEIGHT}` };
}
