// Registry sweep for content work: refreshes stale snapshots, then reports what the skill cannot
// see by reading — dangling refs, orphaned entries, canonical drift and pages that changed.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { SNAPSHOT_MAX_AGE_DAYS, ageInDays, getPage, readSnapshot } from "./fetch-page.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadJson(path) {
  if (!existsSync(path)) {
    console.error(`audit-sources: missing ${path}`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

function normalizeUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    return (u.host + u.pathname).toLowerCase().replace(/\/$/, "");
  } catch {
    return url.toLowerCase();
  }
}

// Every registry key a state leans on: one per sourced fact, plus its additionalResources.
function keysForState(state) {
  const keys = new Set();
  for (const group of ["exam", "criteria"]) {
    for (const fact of Object.values(state[group] ?? {})) {
      if (fact?.source) keys.add(fact.source);
    }
  }
  for (const key of state.additionalResources ?? []) keys.add(key);
  return keys;
}

const args = process.argv.slice(2);
const cert = args.find((a) => !a.startsWith("--"));
const stateArg = args.indexOf("--state");
const stateCode = stateArg !== -1 ? args[stateArg + 1] : null;
const force = args.includes("--force");
const asJson = args.includes("--json");

if (!cert) {
  console.error("audit-sources: usage — node scripts/audit-sources.mjs <cert-slug> [--state <code>] [--force] [--json]");
  process.exit(1);
}

const sources = loadJson(join(ROOT, "src", "content", "sources", `${cert}-sources.json`));
const facts = loadJson(join(ROOT, "src", "content", "certs", `${cert}-facts.json`));

const citedBy = new Map();
for (const [code, state] of Object.entries(facts)) {
  for (const key of keysForState(state)) {
    if (!citedBy.has(key)) citedBy.set(key, []);
    citedBy.get(key).push(code);
  }
}

const dangling = [...citedBy.keys()].filter((k) => !sources[k]).map((k) => ({ key: k, citedBy: citedBy.get(k) }));
const orphaned = Object.keys(sources).filter((k) => !citedBy.has(k));

let scope;
if (stateCode) {
  if (!facts[stateCode]) {
    console.error(`audit-sources: no state "${stateCode}" in ${cert}-facts.json`);
    process.exit(1);
  }
  scope = [...keysForState(facts[stateCode])].filter((k) => sources[k]);
} else {
  scope = Object.keys(sources);
}

const results = [];
for (const key of scope) {
  const entry = sources[key];
  const before = readSnapshot(key);
  const { snapshot, fromCache, previousHash } = await getPage({ key, url: entry.url, force });

  const canonicalDrift =
    snapshot.canonical && normalizeUrl(snapshot.canonical) !== normalizeUrl(entry.url)
      ? snapshot.canonical
      : null;

  results.push({
    key,
    url: entry.url,
    access: entry.access,
    citedBy: citedBy.get(key) ?? [],
    fromCache,
    ageDays: ageInDays(snapshot.fetchedAt),
    status: snapshot.status,
    method: snapshot.method,
    title: snapshot.title ?? null,
    textLength: snapshot.textLength,
    byteLength: snapshot.byteLength,
    canonicalDrift,
    changed: Boolean(before && previousHash && snapshot.hash && previousHash !== snapshot.hash),
    error: snapshot.error ?? null,
  });
}

// A render that produced no text and an HTTP error both mean the citation cannot be checked.
const isFailed = (r) => r.status <= 0 || r.status >= 400;

const summary = {
  cert,
  state: stateCode ?? "all",
  maxAgeDays: SNAPSHOT_MAX_AGE_DAYS,
  checked: results.length,
  fromCache: results.filter((r) => r.fromCache).length,
  fetched: results.filter((r) => !r.fromCache).length,
  failed: results.filter(isFailed).length,
  changed: results.filter((r) => r.changed).length,
  canonicalDrift: results.filter((r) => r.canonicalDrift).length,
  dangling,
  orphaned,
};

if (asJson) {
  console.log(JSON.stringify({ summary, results }, null, 2));
} else {
  console.log(`audit-sources: ${cert} · ${summary.state} · ${summary.checked} sources`);
  console.log(
    `  ${summary.fromCache} from snapshot · ${summary.fetched} fetched · ${summary.failed} failed · ${summary.changed} changed`
  );
  for (const r of results) {
    const flags = [
      isFailed(r) ? `FAILED (${r.status})` : null,
      r.changed ? "CHANGED" : null,
      r.canonicalDrift ? "CANONICAL-DRIFT" : null,
      r.fromCache ? null : "fetched",
    ].filter(Boolean);
    const size = r.method === "binary" ? `${r.byteLength} bytes, not stored` : `${r.textLength} chars`;
    console.log(`  ${r.key} — ${size}, ${r.ageDays}d${flags.length ? ` [${flags.join(", ")}]` : ""}`);
    if (r.title) console.log(`      title: ${r.title}`);
    if (r.canonicalDrift) console.log(`      canonical: ${r.canonicalDrift}`);
    if (r.error) console.log(`      error: ${r.error}`);
  }
  if (dangling.length) {
    console.log("  DANGLING (cited but not in the registry):");
    for (const d of dangling) console.log(`    ${d.key} — cited by ${d.citedBy.join(", ")}`);
  }
  if (orphaned.length) {
    console.log(`  ORPHANED (in the registry, cited by nothing): ${orphaned.join(", ")}`);
  }
}
