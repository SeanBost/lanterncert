// Registry sweep for content work: refreshes stale snapshots, then reports what the skill cannot
// see by reading — dangling refs, orphaned entries, canonical drift and pages that changed.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { SNAPSHOT_MAX_AGE_DAYS, ageInDays, getPage } from "./fetch-page.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CURRENT_YEAR = new Date().getFullYear();

function loadJson(path) {
  if (!existsSync(path)) {
    console.error(`audit-sources: missing ${path}`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

// Canonical tags are routinely root-relative, so they resolve against the page's own URL first.
function normalizeUrl(url, base) {
  if (!url) return null;
  try {
    const u = new URL(url, base);
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

// The cert's lede template cites sources no fact does — a sentence carrying a claim but no figure.
// Without this they read as ORPHANED forever, which is the noise the wall-only split exists to stop.
function keysForIntro(cert) {
  const path = join(ROOT, "src", "content", "intro", `${cert}-intro.json`);
  if (!existsSync(path)) return new Set();
  const keys = new Set();
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== "object") return;
    for (const key of node.cite ?? []) keys.add(key);
  };
  walk(JSON.parse(readFileSync(path, "utf8")).paragraphs ?? []);
  return keys;
}

const args = process.argv.slice(2);
const cert = args.find((a) => !a.startsWith("--"));
const stateArg = args.indexOf("--state");
const stateCode = stateArg !== -1 ? args[stateArg + 1] : null;
const force = args.includes("--force");
const asJson = args.includes("--json");

// Approving a reviewed change. Both re-fetch rather than trusting a staged copy: nothing unreviewed
// is ever written, so there is no staged copy to trust.
const listAfter = (flag) => {
  const i = args.indexOf(flag);
  return i === -1 ? [] : (args[i + 1] ?? "").split(",").filter(Boolean);
};
const applyMeaningful = listAfter("--apply-meaningful");
const applyCosmetic = listAfter("--apply-cosmetic");
const expectArg = args.indexOf("--expect-hash");
const expectHash = expectArg !== -1 ? args[expectArg + 1] : null;
const applying = new Map([
  ...applyMeaningful.map((k) => [k, "meaningful"]),
  ...applyCosmetic.map((k) => [k, "cosmetic"]),
]);

if (!cert) {
  console.error(
    "audit-sources: usage — node scripts/audit-sources.mjs <cert-slug> [--state <code>|xx] [--force] [--json]\n" +
      "                       [--apply-meaningful <key,key>] [--apply-cosmetic <key,key>] [--expect-hash <hash>]"
  );
  process.exit(1);
}

const sources = loadJson(join(ROOT, "src", "content", "sources", `${cert}-sources.json`));
const facts = loadJson(join(ROOT, "src", "content", "facts", `${cert}-facts.json`));

const citedBy = new Map();
const note = (key, by) => {
  if (!citedBy.has(key)) citedBy.set(key, []);
  citedBy.get(key).push(by);
};
for (const [code, state] of Object.entries(facts)) {
  for (const key of keysForState(state)) note(key, code);
}
const introKeys = keysForIntro(cert);
for (const key of introKeys) note(key, "intro");

// ===================== TEMPORARY HARDCODE — DELETE THIS =====================
// Twin of the list in src/content.config.ts; keep them identical until both go.
// Delete this const, the filter and the wallOnly line the moment these states get facts.
const WALL_ONLY_STATES = new Set(["AZ", "HI", "IL", "MA", "MO", "NJ", "OH", "WA"]);
// Listed by key, not by state: scope `multi` is shared with cited entries, so exempting the whole
// scope would silence a genuine future xx- orphan. Goes when the states above do.
const WALL_ONLY_KEYS = new Set(["xx-nhtsa-admin-standards"]);
// ============================================================================

const dangling = [...citedBy.keys()].filter((k) => !sources[k]).map((k) => ({ key: k, citedBy: citedBy.get(k) }));
const isWallOnly = (k) => WALL_ONLY_STATES.has(sources[k].state) || WALL_ONLY_KEYS.has(k);
const orphaned = Object.keys(sources).filter((k) => !citedBy.has(k) && !isWallOnly(k));
const wallOnly = Object.keys(sources).filter(isWallOnly);

const unknownApply = [...applying.keys()].filter((k) => !sources[k]);
if (unknownApply.length) {
  console.error(`audit-sources: no such source key — ${unknownApply.join(", ")}`);
  process.exit(1);
}

// "xx" sweeps the cert-wide sources - scope `multi`, which no state code reaches on its own.
const CERT_WIDE = "xx";

let scope;
if (applying.size) {
  scope = [...applying.keys()];
} else if (stateCode === CERT_WIDE) {
  scope = Object.keys(sources).filter((k) => sources[k].state === "multi");
} else if (stateCode) {
  if (!facts[stateCode]) {
    console.error(
      `audit-sources: no state "${stateCode}" in ${cert}-facts.json (use "${CERT_WIDE}" for the cert-wide sources)`
    );
    process.exit(1);
  }
  scope = [...keysForState(facts[stateCode])].filter((k) => sources[k]);
} else {
  scope = Object.keys(sources);
}

const results = [];
for (const key of scope) {
  const entry = sources[key];
  const apply = applying.get(key) ?? null;
  const { snapshot, fromCache, changed, written, archivedTo, mismatch, previousHash } = await getPage({
    cert,
    key,
    url: entry.url,
    // An apply always re-reads the live page rather than trusting the reported candidate.
    force: force || Boolean(apply),
    apply,
    expectHash: apply ? expectHash : null,
  });

  const canonicalDrift =
    snapshot.canonical && normalizeUrl(snapshot.canonical, entry.url) !== normalizeUrl(entry.url)
      ? snapshot.canonical
      : null;

  // A fresh content window — new record, or a predecessor just archived by an apply or a retarget.
  // It moves originallyFetched, and a document that moved cannot carry either of its years forward.
  const newWindow = Boolean(archivedTo) || (written && previousHash === null);

  const behindYear = (entry.verifiedCurrentIn ?? 0) < CURRENT_YEAR;

  results.push({
    key,
    url: entry.url,
    access: entry.access,
    published: entry.published ?? null,
    verifiedCurrentIn: entry.verifiedCurrentIn ?? null,
    newWindow,
    behindYear,
    // Raised only on a re-read: an unchanged file proves the file is unchanged, never that the
    // publisher still calls it current, and the re-read is when the content is in hand to judge it.
    currencyStale: behindYear && !fromCache,
    citedBy: citedBy.get(key) ?? [],
    fromCache,
    ageDays: ageInDays(snapshot.mostRecentValidation),
    status: snapshot.status,
    method: snapshot.method,
    title: snapshot.title ?? null,
    textLength: snapshot.textLength,
    byteLength: snapshot.byteLength,
    canonicalDrift,
    changed,
    written,
    applied: apply,
    archivedTo,
    mismatch: Boolean(mismatch),
    hash: snapshot.hash ?? null,
    error: snapshot.error ?? null,
  });
}

// A render that produced no text and an HTTP error both mean the citation cannot be checked.
const isFailed = (r) => r.status <= 0 || r.status >= 400;

const summary = {
  cert,
  state: stateCode ?? "all",
  mode: applying.size ? "apply" : "audit",
  maxAgeDays: SNAPSHOT_MAX_AGE_DAYS,
  checked: results.length,
  fromCache: results.filter((r) => r.fromCache).length,
  fetched: results.filter((r) => !r.fromCache).length,
  failed: results.filter(isFailed).length,
  changed: results.filter((r) => r.changed).length,
  // Changes seen but deliberately not written: these are what need a human decision.
  awaitingReview: results.filter((r) => r.changed && !r.written).length,
  applied: results.filter((r) => r.applied && r.written).length,
  archived: results.filter((r) => r.archivedTo).length,
  mismatched: results.filter((r) => r.mismatch).length,
  canonicalDrift: results.filter((r) => r.canonicalDrift).length,
  redate: results.filter((r) => r.newWindow).length,
  currencyStale: results.filter((r) => r.currencyStale).length,
  // Always counted, cached or not, so an outstanding re-dating is never invisible between sweeps.
  behindYear: results.filter((r) => r.behindYear).length,
  dangling,
  orphaned,
  // TEMPORARY — goes with the WALL_ONLY_STATES hardcode above.
  wallOnly,
};

if (asJson) {
  console.log(JSON.stringify({ summary, results }, null, 2));
} else {
  console.log(`audit-sources: ${cert} · ${summary.state} · ${summary.mode} · ${summary.checked} sources`);
  console.log(
    `  ${summary.fromCache} from snapshot · ${summary.fetched} fetched · ${summary.failed} failed · ${summary.changed} changed`
  );
  if (summary.applied || summary.archived || summary.mismatched) {
    console.log(`  ${summary.applied} applied · ${summary.archived} archived · ${summary.mismatched} hash mismatch`);
  }
  for (const r of results) {
    const flags = [
      isFailed(r) ? `FAILED (${r.status})` : null,
      r.mismatch ? "HASH-MISMATCH" : null,
      r.changed && !r.written ? "CHANGED — awaiting review" : null,
      r.changed && r.written ? `CHANGED — applied ${r.applied}` : null,
      r.canonicalDrift ? "CANONICAL-DRIFT" : null,
      r.newWindow ? "REDATE — new content window" : null,
      r.currencyStale ? `CURRENCY-STALE (${r.verifiedCurrentIn ?? "unset"})` : null,
      r.fromCache ? null : "fetched",
    ].filter(Boolean);
    const size = r.method === "binary" ? `${r.byteLength} bytes, not stored` : `${r.textLength} chars`;
    console.log(`  ${r.key} — ${size}, ${r.ageDays}d${flags.length ? ` [${flags.join(", ")}]` : ""}`);
    if (r.title) console.log(`      title: ${r.title}`);
    if (r.canonicalDrift) console.log(`      canonical: ${r.canonicalDrift}`);
    if (r.changed && !r.written) console.log(`      candidate hash: ${r.hash}`);
    if (r.archivedTo) console.log(`      archived: ${r.archivedTo}`);
    if (r.error) console.log(`      error: ${r.error}`);
  }
  if (summary.awaitingReview) {
    const keys = results.filter((r) => r.changed && !r.written).map((r) => r.key);
    console.log(`  AWAITING REVIEW (${summary.awaitingReview}) — nothing written for these:`);
    console.log(`    ${keys.join(", ")}`);
    console.log(`    Approve with: --apply-meaningful <keys>  |  --apply-cosmetic <keys>`);
    console.log(`    Re-check published and verifiedCurrentIn on each before approving.`);
  }
  if (summary.redate) {
    const keys = results.filter((r) => r.newWindow).map((r) => r.key);
    console.log(`  REDATE (${summary.redate}) — new content window, so neither year carries forward:`);
    console.log(`    ${keys.join(", ")}`);
    console.log(`    Re-review published AND verifiedCurrentIn against the document itself.`);
  }
  if (summary.currencyStale) {
    const keys = results.filter((r) => r.currencyStale).map((r) => r.key);
    console.log(`  CURRENCY-STALE (${summary.currencyStale}) — re-read this run, verifiedCurrentIn below ${CURRENT_YEAR}:`);
    console.log(`    ${keys.join(", ")}`);
    console.log(`    Establish currency per Dating a source, then set verifiedCurrentIn — never just bump it.`);
  }
  // Prints even when every source came from cache, so a pending re-dating survives between sweeps.
  if (summary.behindYear) {
    console.log(`  ${summary.behindYear} of ${summary.checked} sources have verifiedCurrentIn below ${CURRENT_YEAR}; each is flagged on its next re-read.`);
  }
  if (dangling.length) {
    console.log("  DANGLING (cited but not in the registry):");
    for (const d of dangling) console.log(`    ${d.key} — cited by ${d.citedBy.join(", ")}`);
  }
  if (orphaned.length) {
    console.log(`  ORPHANED (in the registry, cited by nothing): ${orphaned.join(", ")}`);
  }
  // TEMPORARY — goes with the WALL_ONLY_STATES hardcode above.
  if (wallOnly.length) {
    console.log(`  WALL-ONLY (no facts for these states yet, so exempt from ORPHANED): ${wallOnly.length} entries`);
  }
}
