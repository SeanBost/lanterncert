// The Mock Test's seeded draw: fruit-named seeds, a hash, a PRNG and the draw itself. Pure, so the
// browser and scripts/check-learn.mjs run the same code.

/** Seed names in a permanent order. Append only: removing one breaks every link that used it. */
export const FRUITS = [
  "apple", "apricot", "avocado", "banana", "blackberry", "blueberry", "boysenberry", "cantaloupe",
  "cherry", "clementine", "coconut", "cranberry", "elderberry", "fig", "gooseberry", "grape",
  "grapefruit", "guava", "honeydew", "huckleberry", "jackfruit", "kiwi", "kumquat", "lemon",
  "lime", "lingonberry", "lychee", "mandarin", "mango", "melon", "mulberry", "nectarine",
  "orange", "papaya", "peach", "pear", "persimmon", "pineapple", "plantain", "plum",
  "pomegranate", "pomelo", "quince", "raspberry", "strawberry", "tamarind", "tangerine", "watermelon",
];

/** A known seed, or null for anything else. */
export function resolveSeed(input) {
  const seed = String(input ?? "").trim().toLowerCase();
  return FRUITS.includes(seed) ? seed : null;
}

/** A random seed, avoiding the ones given while any others remain. */
export function pickSeed(avoid = [], random = Math.random) {
  const open = FRUITS.filter((fruit) => !avoid.includes(fruit));
  const from = open.length ? open : FRUITS;
  return from[Math.floor(random() * from.length)];
}

/** cyrb128: a string to four 32-bit words. */
function cyrb128(str) {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

/** sfc32: four words to a generator of floats in [0, 1). */
function sfc32(a, b, c, d) {
  return () => {
    a |= 0;
    b |= 0;
    c |= 0;
    d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

/** The generator for one seed in one state, so Test Orange differs between two states. */
export function rngFor(cert, state, seed) {
  const rng = sfc32(...cyrb128(`${cert}:${state}:${seed}`));
  for (let i = 0; i < 15; i++) rng();
  return rng;
}

/** Fisher-Yates in place, drawing from the generator given. */
export function shuffle(list, random = Math.random) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/**
 * A Mock Test's questions: each topic's quota by weighted sampling without replacement, a question
 * scoped to the state's own code weighted double, sisters excluded once one is taken, then shuffled.
 * @param {{ k: string, topic: string, own: boolean, sisters: string[] }[]} questions the state's pool
 * @param {Record<string, number>} quota questions owed per topic
 * @param {() => number} rng from rngFor
 */
export function drawMockTest(questions, quota, rng) {
  // By idKey, so the draw depends on the bank and never on the order its JSON lists entries in.
  const pool = [...questions].sort((a, b) => Number(a.k) - Number(b.k));
  const taken = [];
  const out = new Set();

  /** Up to n from one topic; returns how many it fell short by. */
  const take = (topic, n) => {
    // Efraimidis-Spirakis: each candidate keyed u^(1/w), the largest keys taken.
    const keyed = pool
      .filter((q) => q.topic === topic && !out.has(q.k))
      .map((q) => ({ q, key: rng() ** (1 / (q.own ? 2 : 1)) }))
      .sort((a, b) => b.key - a.key);
    let got = 0;
    for (const { q } of keyed) {
      if (got === n) break;
      if (out.has(q.k)) continue;
      taken.push(q);
      out.add(q.k);
      for (const sister of q.sisters ?? []) out.add(sister);
      got++;
    }
    return n - got;
  };

  const topics = Object.keys(quota).filter((t) => quota[t] > 0).sort();
  let short = 0;
  for (const topic of topics) short += take(topic, quota[topic]);

  // A shortfall goes one at a time to the topics owed the most, so the count is always exact.
  const byShare = Object.keys(quota).sort((a, b) => quota[b] - quota[a] || a.localeCompare(b));
  while (short > 0) {
    const before = short;
    for (const topic of byShare) {
      if (short === 0) break;
      short -= 1 - take(topic, 1);
    }
    if (short === before) break;
  }

  return shuffle(taken, rng);
}

/** The A, a score worth more than a pass. */
export const A_PERCENT = 90;

/** Whole-number scoring, so a pass mark is never missed by a float. */
export function scoreTest(correct, count, passPercent) {
  return {
    correct,
    count,
    percent: Math.round((correct * 100) / count),
    passed: correct * 100 >= passPercent * count,
    a: correct * 100 >= A_PERCENT * count,
  };
}
