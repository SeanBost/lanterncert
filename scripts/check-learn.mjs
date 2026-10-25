// Checks the study tool's built artifacts: every state's pool in /dist, every seeded draw, the format
// each pool carries, and a round trip through the progress store. Run after `npm run build`.
//
//   node scripts/check-learn.mjs
//
// Exits 1 on any problem. Reads /dist and the content files; reaches no network.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { FRUITS, drawMockTest, rngFor } from "../src/lib/seeded.js";

const ROOT = resolve(import.meta.dirname, "..");
const DIST = join(ROOT, "dist");
const read = (path) => JSON.parse(readFileSync(join(ROOT, path), "utf8"));
const problems = [];
const fail = (where, what) => problems.push(`${where}: ${what}`);

if (!existsSync(DIST)) {
  console.error("no /dist - run npm run build first");
  process.exit(1);
}

const config = read("src/site-config.json").certTypes;

/** Every built pool, as [cert, state, path]. */
const pools = [];
for (const cert of Object.keys(config)) {
  const certDir = join(DIST, cert);
  if (!existsSync(certDir)) continue;
  for (const state of readdirSync(certDir)) {
    const path = join(certDir, state, "learn", "pool.json");
    if (existsSync(path)) pools.push([cert, state, path]);
  }
}
if (!pools.length) fail("dist", "no learn/pool.json found");

// ---- Each pool -----------------------------------------------------------------------------------

for (const [cert, state, path] of pools) {
  const where = `${cert}/${state}`;
  const pool = JSON.parse(readFileSync(path, "utf8"));
  const facts = read(`src/content/facts/${cert}-facts.json`)[state];
  const defaults = config[cert].testDefaults;
  const html = readFileSync(join(DIST, cert, state, "learn", "index.html"), "utf8");
  const slugs = new Set(pool.topics.map((t) => t.slug));
  const keys = new Set();

  if (!pool.questions.length) fail(where, "the pool is empty");
  if (Object.keys(pool.quota).some((t) => !slugs.has(t))) fail(where, "a quota names a topic the pool doesn't serve");

  for (const q of pool.questions) {
    const at = `${where} #${q.k}`;
    if (keys.has(q.k)) fail(at, "appears twice");
    keys.add(q.k);
    if (!slugs.has(q.topic)) fail(at, `is in "${q.topic}", which the pool doesn't serve`);
    if (!pool.sources[q.src]) fail(at, `cites source index ${q.src}, out of range`);
    if (!q.choices.some((c) => c.id === q.answer)) fail(at, "has no choice matching its answer");
    if (q.media) {
      if (!existsSync(join(ROOT, "public", q.media.src))) fail(at, `points at a missing image, ${q.media.src}`);
      if (q.media.credit !== null && !pool.sources[q.media.credit]) fail(at, "credits a source index out of range");
    }
    if (q.guide && !html.includes(`id="fact-${q.guide}"`)) fail(at, `links to guide line fact-${q.guide}, which the guide doesn't render`);
  }
  for (const topic of pool.topics) {
    if (!html.includes(`id="${topic.slug}"`)) fail(where, `the guide has no section for ${topic.slug}`);
    if (topic.count !== pool.questions.filter((q) => q.topic === topic.slug).length) fail(where, `${topic.slug}'s count is off`);
  }

  // The format: each field the state's own where published, the cert's default where not.
  const { count, pass, minutes, needed } = pool.format;
  const expect = (name, field, fact, fallback) => {
    const published = fact?.value != null;
    if (field.ours === published) fail(where, `format ${name} is marked ${field.ours ? "LanternCert's" : "the state's"}`);
    if (published && field.value !== fact.value) fail(where, `format ${name} ${field.value} isn't the published ${fact.value}`);
    if (!published && field.value !== fallback) fail(where, `format ${name} ${field.value} isn't the default ${fallback}`);
  };
  expect("count", count, facts.exam.questionCount, defaults.questionCount);
  expect("pass mark", pass, facts.exam.passingScorePercent, defaults.passingScorePercent);
  expect("minutes", minutes, facts.exam.timeLimitMinutes, Math.ceil(count.value * defaults.minutesPerQuestion));
  if (needed !== Math.ceil((pass.value * count.value) / 100)) fail(where, `needed ${needed} doesn't match the pass mark`);
  const owed = Object.values(pool.quota).reduce((a, b) => a + b, 0);
  if (owed !== count.value) fail(where, `the quota owes ${owed} questions for a ${count.value}-question test`);

  // Every seed draws exactly the format's count, repeatably, with no duplicates and no two sisters.
  for (const seed of FRUITS) {
    const at = `${where} Test ${seed}`;
    const draw = drawMockTest(pool.questions, pool.quota, rngFor(cert, state, seed));
    const again = drawMockTest(pool.questions, pool.quota, rngFor(cert, state, seed));
    const ks = draw.map((q) => q.k);
    if (ks.length !== count.value) fail(at, `draws ${ks.length}, not ${count.value}`);
    if (new Set(ks).size !== ks.length) fail(at, "draws a question twice");
    if (ks.join() !== again.map((q) => q.k).join()) fail(at, "draws differently on a second run");
    for (const q of draw) {
      if (q.sisters.some((s) => ks.includes(s))) fail(at, `draws #${q.k} beside its sister`);
    }
    for (const [topic, n] of Object.entries(pool.quota)) {
      const got = draw.filter((q) => q.topic === topic).length;
      const held = pool.questions.filter((q) => q.topic === topic).length;
      if (got !== n && held >= n) fail(at, `draws ${got} from ${topic}, owed ${n}`);
    }
  }
  console.log(`${where}: ${pool.questions.length} questions, ${FRUITS.length} seeds drawn`);
}

// ---- The store, round-tripped through a stand-in localStorage --------------------------------------

const memory = new Map();
globalThis.localStorage = {
  getItem: (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => memory.set(k, String(v)),
  removeItem: (k) => memory.delete(k),
};
globalThis.window = { addEventListener() {} };
const store = await import("../src/scripts/learn/store.js");
const raw = () => JSON.parse(memory.get("lanterncert"));
const check = (ok, what) => ok || fail("store", what);

store.recordAnswer("c", "s", "57", true, "c");
store.recordAnswer("c", "s", "57", false, "t");
check(raw().certs.c.s.answers["57"].length === 2, "an answer wasn't recorded");
for (let i = 0; i < 8; i++) store.recordAnswer("c", "s", "57", true, "c");
check(raw().certs.c.s.answers["57"].length === 5, "answer history isn't capped at five");

const items = [{ k: "57", order: ["b", "a"], chose: "a", flag: false }];
store.startTest("c", "s", { seed: "orange", startedAt: 1, deadline: 2, timed: true, current: 0, items });
store.updateTest("c", "s", { current: 0, items: [{ ...items[0], flag: true }] });
check(raw().certs.c.s.inProgress.items[0].flag === true, "an in-progress update was lost");
store.finishTest("c", "s", { seed: "orange", endedAt: 3, correct: 1, count: 1, pass: 80, status: "complete", items: [{ ...items[0], right: true }] });
check(raw().certs.c.s.inProgress === null && raw().certs.c.s.tests.length === 1, "a finished test wasn't filed");

check(JSON.parse(store.exportBlob()).certs.c.s.tests.length === 1, "the download is missing the test");
store.erase();
check(Object.keys(raw().certs).length === 0 && raw().tracking === true, "erase left data or flipped tracking");

store.setTracking(false);
check(JSON.stringify(raw()) === JSON.stringify({ version: 1, tracking: false, prefs: {}, certs: {} }), "tracking off kept data");
store.recordAnswer("c", "s", "57", true, "c");
check(Object.keys(raw().certs).length === 0, "tracking off still wrote an answer");
store.startTest("c", "s", { seed: "kiwi", startedAt: 1, deadline: null, timed: false, current: 0, items });
store.updateTest("c", "s", { current: 0 });
check(store.stateRecord("c", "s").inProgress?.seed === "kiwi", "tracking off lost the in-memory test");
check(Object.keys(raw().certs).length === 0, "tracking off persisted a test");
store.setTracking(true);
check(raw().tracking === true, "tracking didn't turn back on");

console.log("store: round trip checked");

if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n${problems.map((p) => `  ${p}`).join("\n")}`);
  process.exit(1);
}
console.log("\nAll checks passed.");
