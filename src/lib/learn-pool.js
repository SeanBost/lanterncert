// A state's question pool: the one place a bank entry becomes a served question. Build-only (it reads
// the disk); the browser gets the result from /[cert]/[state]/learn/pool.json via scripts/learn/bank.js.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getCollection } from "astro:content";
import states from "../content/states.json";
import { loadAllSources, loadState, mockTestFormat, stateInfo } from "./cert-data.js";
import { questionsForState } from "./applies-to.js";
import { topicQuota, topicsForState } from "./topic-weights.js";
import { ORIGINAL_ART, creditOf } from "./image-credit.js";

export const POOL_VERSION = 1;

const weightsByCert = Object.fromEntries(
  Object.entries(import.meta.glob("../content/weights/*-weights.json", { eager: true })).map(
    ([path, mod]) => [path.match(/([^/]+)-weights\.json$/)[1], /** @type {any} */ (mod).default],
  ),
);

/** A file under public/. From the project root, since this module is bundled before it runs. */
const publicFile = (src) => join(process.cwd(), "public", src);

/** An SVG's own viewBox size, so an image reserves its space before it loads. */
function svgSize(src) {
  const box = readFileSync(publicFile(src), "utf8").match(/viewBox="[\d.-]+[\s,]+[\d.-]+[\s,]+([\d.]+)[\s,]+([\d.]+)"/);
  return box ? { w: Number(box[1]), h: Number(box[2]) } : { w: 240, h: 240 };
}

/** The cert's topics keyed by slug. */
async function topicsFor(cert) {
  const entries = await getCollection(`${cert}-topics`);
  return Object.fromEntries(entries.map((t) => [t.id, t.data]));
}

const cache = new Map();

/**
 * The served pool for one state: scope first, then served topics, then normalized.
 * @returns {Promise<any>} the shape scripts/learn/ reads; POOL_VERSION moves when it changes.
 */
export function poolForState(cert, state) {
  const key = `${cert}/${state}`;
  if (!cache.has(key)) cache.set(key, build(cert, state));
  return cache.get(key);
}

async function build(cert, state) {
  const facts = await loadState(cert, state);
  const info = stateInfo(state);
  const weights = weightsByCert[cert];
  const topics = await topicsFor(cert);
  const exams = Object.fromEntries((await getCollection(`${cert}-exams`)).map((e) => [e.id, e.data]));
  const registry = Object.fromEntries((await loadAllSources(cert)).map((s) => [s.id, s]));
  const format = mockTestFormat(cert, facts);

  const served = topicsForState(state, weights).sort((a, b) => topics[a].num - topics[b].num);
  const bank = (await getCollection(`${cert}-questions`)).map((q) => ({
    id: q.id,
    appliesTo: q.data.meta.appliesTo,
    topic: q.data.meta.topic,
    ...q.data,
  }));
  const mine = questionsForState(bank, state, { states, facts: { [state]: facts }, exams }).filter(
    (q) => served.includes(q.topic),
  );
  const byKey = new Map(mine.map((q) => [q.meta.idKey, q]));

  // Sources are listed once and referenced by index.
  const sources = [];
  const sourceIndex = (id) => {
    let i = sources.findIndex((s) => s.id === id);
    if (i === -1) {
      const entry = registry[id];
      if (!entry) throw new Error(`learn-pool: ${state} cites "${id}", which the registry does not hold`);
      i = sources.push({ id, title: entry.title, url: entry.url, publisher: entry.publisher }) - 1;
    }
    return i;
  };

  /** The guide line teaching a question: its own, or the sister's that carries one. */
  const guideKey = (q) => {
    if (q.guide) return q.meta.idKey;
    const sister = (q.meta.sisterQuestions ?? []).find((k) => byKey.get(k)?.guide);
    return sister ?? null;
  };

  const media = (m) => {
    if (!m) return null;
    const credit = creditOf(m.src);
    return {
      src: m.src,
      alt: m.alt,
      credit: credit === ORIGINAL_ART ? null : sourceIndex(credit),
      needed: m.neededForQ,
      ...svgSize(m.src),
    };
  };

  const questions = mine.map((q) => ({
    k: q.meta.idKey,
    topic: q.topic,
    own: q.appliesTo === info.abbreviation,
    q: q.content.question,
    choices: q.content.choices,
    answer: q.content.correctAnswer,
    why: q.content.explanation,
    media: media(q.content.media),
    guide: guideKey(q),
    src: sourceIndex(q.meta.source.id),
    section: q.meta.sourceSection,
    verified: q.meta.lastVerified,
    sisters: q.meta.sisterQuestions ?? [],
  }));

  const quotaAll = topicQuota(state, weights, format.count.value);
  return {
    version: POOL_VERSION,
    cert,
    state,
    format,
    quota: Object.fromEntries(served.map((t) => [t, quotaAll[t]])),
    topics: served.map((slug) => ({
      slug,
      name: topics[slug].name,
      emoji: topics[slug].emoji,
      count: questions.filter((q) => q.topic === slug).length,
    })),
    sources,
    questions,
  };
}
