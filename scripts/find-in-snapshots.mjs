// Phrase search across a cert's snapshots, with the source documents' line wrapping normalized away.
// data-handling.md ▸ Sources — fetching and snapshots, rule 4a.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// Caps how many silent snapshots the summary lists by name.
const SILENT_LIST_CAP = 12;
const HITS_PER_SNAPSHOT = 5;

function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

const args = process.argv.slice(2);
const VALUE_FLAGS = new Set(["--key", "--context"]);
const flag = (name) => args.includes(name);
const value = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? null : args[i + 1];
};
const positional = args.filter((a, i) => !a.startsWith("--") && !VALUE_FLAGS.has(args[i - 1]));

if (positional.length < 2 || flag("--help")) {
  console.error(
    'find-in-snapshots: usage — node scripts/find-in-snapshots.mjs <cert-slug|slugShort> "<regex>" [--key <source-key>] [--context <chars>] [--raw]',
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
  console.error(`find-in-snapshots: "${certArg}" is not a cert slug or slugShort in site-config.json`);
  process.exit(1);
}

const dir = join(ROOT, "blackbox", "source-snapshots", cert);
if (!existsSync(dir)) {
  console.error(`find-in-snapshots: no snapshots at ${dir}`);
  process.exit(1);
}

const only = value("--key");
const ctx = Number(value("--context") ?? 260);
const keys = readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.slice(0, -5))
  .filter((k) => !only || k === only);

if (!keys.length) {
  console.error(`find-in-snapshots: no snapshot matches --key ${only}`);
  process.exit(1);
}

const pattern = positional[1];
try {
  new RegExp(pattern);
} catch {
  console.error(`find-in-snapshots: "${pattern}" is not a valid regular expression`);
  process.exit(1);
}

// Rejoins words hyphenated across a line end, then collapses every run of whitespace to one space.
const normalize = (s) => s.replace(/-\s*\n\s*/g, "").replace(/\s+/g, " ");

const searchRaw = flag("--raw");
let totalHits = 0;
const silent = [];

for (const key of keys) {
  const snapshot = loadJson(join(dir, `${key}.json`));
  const text = normalize(snapshot.text ?? "");
  const re = new RegExp(pattern, "gi");
  const hits = [];
  let m;
  while ((m = re.exec(text)) && hits.length < HITS_PER_SNAPSHOT) {
    hits.push(text.slice(Math.max(0, m.index - 90), m.index + ctx));
    if (m.index === re.lastIndex) re.lastIndex += 1;
  }
  totalHits += hits.length;

  if (!hits.length) {
    silent.push(key);
    // Re-runs a zero-hit against the unnormalized text and reports a disagreement.
    if (searchRaw) {
      const rawHits = (snapshot.text ?? "").match(new RegExp(pattern, "gi"))?.length ?? 0;
      if (rawHits) console.log(`\n===== ${key} — RAW DISAGREES: ${rawHits} hit(s) unnormalized. Read it.`);
    }
    continue;
  }

  console.log(`\n===== ${key} — ${hits.length} hit(s) =====`);
  hits.forEach((h, i) => console.log(`  [${i + 1}] …${h}…`));
}

const found = keys.length - silent.length;
console.log(`\n${keys.length} searched · ${found} with hits · ${totalHits} hit(s) · ${silent.length} silent`);
if (silent.length) {
  if (silent.length <= SILENT_LIST_CAP) console.log(`silent: ${silent.join(", ")}`);
  else console.log(`silent list suppressed past ${SILENT_LIST_CAP} — narrow with --key to see it`);
  console.log("A zero-hit is not absence. Re-run with a second phrasing before recording a verdict.");
}
