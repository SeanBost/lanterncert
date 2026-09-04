// Bank sweep: what Zod cannot express because it needs every state's resolution, not one entry.
// PROBLEM exits non-zero; NOTE never does. data-handling.md ▸ Questions.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { scopeTokens } from "../src/lib/applies-to.js";
import { topicShares, weightsForState } from "../src/lib/topic-weights.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const QUOTA_MULTIPLIER = 1.5;
// Two images per topic per state, so a guide section is never a wall of text. Signs carry their own.
const IMAGES_PER_TOPIC = 2;

function loadJson(path, required = true) {
  if (!existsSync(path)) {
    if (!required) return null;
    console.error(`audit-questions: missing ${path}`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? null : args[i + 1];
};
// Walked rather than filtered: indexOf finds the first match, so a repeated value misreads.
const positional = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--state");

if (!positional.length || flag("--help")) {
  console.error(
    "audit-questions: usage — node scripts/audit-questions.mjs <cert-slug|slugShort> [--state <code>] [--json]",
  );
  process.exit(1);
}

const siteConfig = loadJson(join(ROOT, "src", "site-config.json"));
// Takes either form, so the skills and the scripts can be invoked the same way.
const certArg = positional[0];
const cert =
  siteConfig.certTypes[certArg]?.slug ??
  Object.keys(siteConfig.certTypes).find((k) => siteConfig.certTypes[k].slugShort === certArg);
if (!cert) {
  console.error(`audit-questions: "${certArg}" is not a cert slug or slugShort in site-config.json`);
  process.exit(1);
}
const certConfig = siteConfig.certTypes[cert];

const content = (kind, suffix = kind) => join(ROOT, "src", "content", kind, `${cert}-${suffix}.json`);
const states = loadJson(join(ROOT, "src", "content", "states.json"));
const facts = loadJson(content("facts"));
const exams = loadJson(content("exams"));
const topics = loadJson(content("topics"));
const weights = loadJson(content("weights"));
const questionBank = loadJson(content("questions"));
const guideScaffold = loadJson(content("guide"));
// Optional and private, so a checkout without it still runs — but silently, which is the trap.
const exclusionsPath = join(ROOT, "blackbox", "authoring", `${cert}-exclusions.json`);
const exclusions = loadJson(exclusionsPath, false) ?? {};

const only = value("--state");
const stateSlugs = Object.keys(facts).filter((s) => !only || s === only);
if (only && !stateSlugs.length) {
  console.error(`audit-questions: no facts for state "${only}" in ${cert}`);
  process.exit(1);
}

const problems = [];
const notes = [];
const problem = (check, message) => problems.push({ check, message });
const note = (check, message) => notes.push({ check, message });

// The bank as a flat list, since every check below reads the id and the key is the id.
const bank = Object.entries(questionBank).map(([id, q]) => ({ id, ...q }));
const ctx = { states, facts, exams };
const resolvedFor = Object.fromEntries(
  stateSlugs.map((slug) => {
    const tokens = scopeTokens(slug, ctx);
    return [slug, bank.filter((q) => tokens.has(q.meta.applies_to))];
  }),
);

/** Mock Test length: the state's own count where published, the cert's fallback where not. */
function mockLength(slug) {
  return facts[slug].exam?.questionCount?.value ?? certConfig.testDefaults?.questionCount ?? null;
}

// ── variantGroup coverage ────────────────────────────────────────────────────
// Reports any state with facts that a variantGroup does not reach. data-handling.md ▸ Questions §5b.
const groups = new Map();
for (const q of bank) {
  if (!q.meta.variantGroup) continue;
  if (!groups.has(q.meta.variantGroup)) groups.set(q.meta.variantGroup, []);
  groups.get(q.meta.variantGroup).push(q);
}

const declared = exclusions.variantGroups ?? {};
// Without it every deliberate gap reads as a PROBLEM, so the run says which mode it is in.
if (!existsSync(exclusionsPath)) {
  note("variant-coverage", `no exclusions file at ${exclusionsPath} — every gap will read as undeclared`);
}
for (const [group, members] of groups) {
  const covered = new Set(
    stateSlugs.filter((slug) => resolvedFor[slug].some((q) => q.meta.variantGroup === group)),
  );
  const missing = stateSlugs.filter((slug) => !covered.has(slug));
  for (const slug of missing) {
    const reason = declared[group]?.[slug];
    if (reason) {
      note("variant-coverage", `${group} deliberately omits ${slug} — ${reason}`);
    } else {
      problem(
        "variant-coverage",
        `${group} reaches ${[...covered].join(", ") || "no state"} but not ${slug}, and nothing declares that gap`,
      );
    }
  }
  if (members.length === 1) {
    note(
      "variant-coverage",
      `${group} has one member (${members[0].id}) — a group of one is either unfinished or should not be a group`,
    );
  }
}

// An exclusion naming a group or state that no longer exists is a rule outliving its reason.
for (const [group, byState] of Object.entries(declared)) {
  if (!groups.has(group)) {
    note("variant-coverage", `exclusions name variantGroup ${group}, which no question carries`);
    continue;
  }
  for (const slug of Object.keys(byState)) {
    if (!(slug in facts)) note("variant-coverage", `exclusions name ${group}.${slug}, which has no facts`);
  }
}

// ── quota coverage ───────────────────────────────────────────────────────────
// mockLength x topicShare x 1.5, per state per topic. data-handling.md ▸ Questions §13.
const quotaRows = [];
for (const slug of stateSlugs) {
  const length = mockLength(slug);
  if (length === null) {
    problem("quota", `${slug} has no question count and the cert declares no testDefaults fallback`);
    continue;
  }
  const shares = topicShares(slug, weights);
  const resolved = weightsForState(slug, weights);
  for (const [topic, share] of Object.entries(shares)) {
    if (!(resolved[topic] > 0)) continue;
    const target = Math.round(share * length * QUOTA_MULTIPLIER);
    const have = resolvedFor[slug].filter((q) => q.meta.topic === topic).length;
    quotaRows.push({ slug, topic, have, target, short: Math.max(0, target - have) });
  }
}

// ── images per guide section ─────────────────────────────────────────────────
// Reported per topic, and only once that topic has questions to hang art on.
let unstartedTopics = 0;
for (const topic of new Set(quotaRows.map((r) => r.topic))) {
  const rows = quotaRows.filter((r) => r.topic === topic);
  if (rows.every((r) => r.have === 0)) {
    unstartedTopics++;
    continue;
  }
  const short = rows
    .map(({ slug }) => ({
      slug,
      art: resolvedFor[slug].filter((q) => q.meta.topic === topic && q.content.media).length,
    }))
    .filter((r) => r.art < IMAGES_PER_TOPIC);
  if (short.length) {
    const detail = short.map((r) => `${r.slug} ${r.art}`).join(", ");
    note("images", `${topic} is under ${IMAGES_PER_TOPIC} art questions for: ${detail}`);
  }
}
if (unstartedTopics) {
  note("images", `${unstartedTopics} topic(s) have no questions yet, so their art is not assessed`);
}

// ── scope claims worth re-reading ────────────────────────────────────────────
// Flags a quantity in a question scoped wider than one state. data-handling.md ▸ Questions §4.
// A number word counts only beside a unit; a bare "one" is ordinary English, not a quantity.
const UNITS =
  "seconds?|minutes?|hours?|days?|weeks?|months?|years?|feet|foot|inch(?:es)?|yards?|miles?|mph|percent|degrees?|pounds?|gears?|times|lanes?|points?";
const NUMBER_WORD = "one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty";
const QUANTITY = new RegExp(`\\b\\d+(?:\\.\\d+)?%?\\b|\\b(?:${NUMBER_WORD})[- ](?:${UNITS})\\b`, "gi");
const FRACTION = /\b(?:half|halves|thirds?|quarters?|three-quarters)\b/gi;
const stateCodes = new Set(Object.values(states).map((s) => s.abbreviation));
for (const q of bank) {
  if (stateCodes.has(q.meta.applies_to)) continue;
  const text = [
    q.content.question,
    q.content.explanation,
    ...q.content.choices.map((c) => c.text),
    q.guide?.text ?? "",
    q.guide?.label ?? "",
  ].join(" ");
  const found = [...new Set([...(text.match(QUANTITY) ?? []), ...(text.match(FRACTION) ?? [])])];
  if (found.length) {
    note(
      "wide-scope-number",
      `${q.id} is scoped ${q.meta.applies_to} and carries a quantity (${found.join(", ")}) — confirm every covered state's document states it`,
    );
  }
}

// ── guide structure ──────────────────────────────────────────────────────────
const guided = bank.filter((q) => q.guide);
const ungrouped = guided.filter((q) => !q.guide.group);
if (ungrouped.length) {
  note(
    "guide-grouping",
    `${ungrouped.length} of ${guided.length} guide facts are ungrouped: ${ungrouped.map((q) => q.id).join(", ")}`,
  );
}
for (const [topic, section] of Object.entries(guideScaffold)) {
  if (topic === "_about") continue;
  for (const group of section.groups ?? []) {
    const used = guided.some((q) => q.meta.topic === topic && q.guide.group === group.id);
    if (!used) note("guide-grouping", `${topic} ▸ ${group.id} is scaffolded but no question joins it`);
  }
}

// A topic weighted 0 everywhere reaches no surface, so a question in it is authored for nobody.
for (const topic of Object.keys(topics)) {
  const served = stateSlugs.some((slug) => weightsForState(slug, weights)[topic] > 0);
  const held = bank.filter((q) => q.meta.topic === topic);
  if (!served && held.length) {
    note(
      "unserved-topic",
      `${topic} is weighted 0 in every state, so its ${held.length} question(s) reach no rider`,
    );
  }
}

// ── near-duplicate stems ─────────────────────────────────────────────────────
// A re-angle is legitimate and declares itself through sisterQuestions; an undeclared twin is drift.
const normalize = (s) => new Set(s.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter(Boolean));
for (let i = 0; i < bank.length; i++) {
  for (let j = i + 1; j < bank.length; j++) {
    const [a, b] = [bank[i], bank[j]];
    const [x, y] = [normalize(a.content.question), normalize(b.content.question)];
    const shared = [...x].filter((t) => y.has(t)).length;
    const similarity = shared / Math.max(x.size, y.size);
    if (similarity < 0.75) continue;
    const linked =
      (a.meta.sisterQuestions ?? []).includes(b.meta.idKey) ||
      (a.meta.variantGroup && a.meta.variantGroup === b.meta.variantGroup);
    if (!linked) {
      note(
        "near-duplicate",
        `${a.id} and ${b.id} share ${Math.round(similarity * 100)}% of their stem and declare no sisterQuestions or variantGroup link`,
      );
    }
  }
}

// ── sourceSection ────────────────────────────────────────────────────────────
const uncaptioned = bank.filter((q) => !q.meta.sourceSection);
if (uncaptioned.length) {
  note(
    "source-section",
    `${uncaptioned.length} question(s) carry no sourceSection, legal only where the document has no internal structure: ${uncaptioned.map((q) => q.id).join(", ")}`,
  );
}

// ── report ───────────────────────────────────────────────────────────────────
if (flag("--json")) {
  console.log(JSON.stringify({ cert, states: stateSlugs, quota: quotaRows, problems, notes }, null, 2));
  process.exit(problems.length ? 1 : 0);
}

const shortfall = quotaRows.reduce((sum, r) => sum + r.short, 0);
console.log(
  `audit-questions: ${cert} · ${bank.length} questions · ${stateSlugs.length} state(s) · ${problems.length} PROBLEM, ${notes.length} NOTE`,
);

console.log(`\nQUOTA — resolving/target per topic, ${QUOTA_MULTIPLIER}x Mock Test length`);
const topicOrder = Object.keys(topics);
const width = Math.max(...topicOrder.map((t) => t.length)) + 2;
console.log("  " + "topic".padEnd(width) + stateSlugs.map((s) => s.toUpperCase().padEnd(10)).join(""));
for (const topic of topicOrder) {
  const cells = stateSlugs.map((slug) => {
    const row = quotaRows.find((r) => r.slug === slug && r.topic === topic);
    return (row ? `${row.have}/${row.target}` : "-").padEnd(10);
  });
  console.log("  " + topic.padEnd(width) + cells.join(""));
}
const totals = stateSlugs.map((slug) => {
  const rows = quotaRows.filter((r) => r.slug === slug);
  const have = rows.reduce((s, r) => s + r.have, 0);
  const target = rows.reduce((s, r) => s + r.target, 0);
  return `${have}/${target}`.padEnd(10);
});
console.log("  " + "TOTAL".padEnd(width) + totals.join(""));
console.log(`  ${shortfall} question-slots still to author across every state and topic.`);

for (const [label, list] of [["PROBLEM", problems], ["NOTE", notes]]) {
  if (!list.length) continue;
  console.log(`\n${label} (${list.length})`);
  for (const check of [...new Set(list.map((e) => e.check))]) {
    console.log(`  ${check}`);
    for (const entry of list.filter((e) => e.check === check)) console.log(`    ${entry.message}`);
  }
}

if (!problems.length) console.log("\nNo PROBLEM findings.");
process.exit(problems.length ? 1 : 0);
