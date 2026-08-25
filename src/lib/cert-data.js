// Loading helpers shared by every cert/state route. Collection names are built from the cert slug.
import { getCollection, getEntry } from "astro:content";
import siteConfig from "../site-config.json";
import states from "../content/states.json";

export const site = siteConfig.site;
export const certs = siteConfig.testTypes;

// The build gate for site-config.json, which gets no Zod pass. data-handling.md ▸ Site config.
for (const [key, config] of Object.entries(certs)) {
  for (const field of ["name", "slug", "blurb", "timeToCertify"]) {
    if (typeof config[field] !== "string" || config[field].trim() === "") {
      throw new Error(`site-config.json ▸ testTypes ▸ ${key}: "${field}" is missing or empty`);
    }
  }
  if (config.slug !== key) {
    throw new Error(`site-config.json ▸ testTypes ▸ ${key}: slug "${config.slug}" does not match key`);
  }
  if (typeof config.stateDependent !== "boolean") {
    throw new Error(`site-config.json ▸ testTypes ▸ ${key}: "stateDependent" must be a boolean`);
  }
}

export function certConfig(cert) {
  return certs[cert] ?? null;
}

// Display strings for constrained token values, keyed by cert slug. The schema module guarantees
// every token has an entry, so a lookup here never misses. data-handling.md ▸ Cert facts ▸ Display.
const displays = Object.fromEntries(
  Object.entries(import.meta.glob("../content/display/*-display.json", { eager: true })).map(
    ([path, mod]) => [path.match(/([^/]+)-display\.json$/)[1], mod.default],
  ),
);

// The lede template for each cert, loaded the same way as display strings and for the same reason:
// it is per-cert content, not a collection. src/content/intro/<cert>-intro.json ▸ _about.
const intros = Object.fromEntries(
  Object.entries(import.meta.glob("../content/intro/*-intro.json", { eager: true })).map(
    ([path, mod]) => [path.match(/([^/]+)-intro\.json$/)[1], mod.default],
  ),
);

export function certIntro(cert) {
  return intros[cert] ?? null;
}

const stateCodes = new Set(Object.values(states).map((s) => s.abbreviation));

export function escapeHtml(text) {
  return String(text).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

/**
 * Resolves a token to its display string. data-handling.md ▸ Cert facts ▸ Display strings.
 * `asHtml` escapes the filled values only - pass it only from a caller that renders HTML.
 * @param {{ asHtml?: boolean, stateName?: string | null, stateCode?: string | null }} [opts]
 * @returns {(field: string, fact: any, form?: "short" | "long") => string | null}
 */
export function tokenDisplay(cert, facts, opts = {}) {
  const { asHtml = false, stateName = null, stateCode = null } = opts;
  const map = displays[cert] ?? {};
  const safe = asHtml ? escapeHtml : (v) => v;
  const vars = {
    agencyCode: safe(facts.meta.agencyCode),
    agencyName: safe(facts.meta.agencyName),
    examName: facts.exam.examName?.value == null ? null : safe(facts.exam.examName.value),
    stateName: stateName === null ? null : safe(stateName),
    stateCode: stateCode === null ? null : safe(stateCode),
  };
  // A placeholder naming nothing is a typo, and rendering it as "" is how it hides - a missing state
  // name reads as "-run directory" on the page and as nothing at all in the build.
  const fill = (text) =>
    text.replace(/\{(\w+)\}/g, (_, key) => {
      if (!(key in vars)) {
        throw new Error(`${cert}-display.json: "{${key}}" is not a display variable`);
      }
      return vars[key] ?? "";
    });

  return (field, fact, form = "short") => {
    if (fact.value === null) return null;
    const entry = map[field]?.[fact.value];
    if (entry) return fill(entry[form]);

    const pattern = stateCodes.has(fact.value) ? map[field]?._stateSpecific : null;
    if (!pattern) return null;
    return fill((vars.examName ? pattern.named : pattern.unnamed)[form]);
  };
}

export function stateInfo(slug) {
  return states[slug] ?? null;
}

/** Every { cert, state } pair a state-dependent cert actually holds facts for. */
export async function certStatePaths() {
  const paths = [];
  for (const [cert, config] of Object.entries(certs)) {
    if (!config.stateDependent) continue;
    // From the facts collection, not states.json, so a state with no data can't publish an empty page.
    const facts = await getCollection(`${cert}-facts`);
    for (const entry of facts) paths.push({ params: { cert, state: entry.id } });
  }
  return paths;
}

// any: a slug-built collection name infers as a union of every collection; Zod guarantees the shape.
/** @returns {Promise<any>} */
export async function loadState(cert, state) {
  const entry = await getEntry(`${cert}-facts`, state);
  return entry?.data ?? null;
}

/** Hydrates registry keys into entries, preserving the order they were asked for. */
/** @returns {Promise<any[]>} */
export async function loadSourceEntries(cert, ids) {
  const entries = await Promise.all(ids.map((id) => getEntry(`${cert}-sources`, id)));
  return entries.filter(Boolean).map((e) => ({ id: e.id, ...e.data }));
}

/** The whole registry for a cert, cited or not. */
/** @returns {Promise<any[]>} */
export async function loadAllSources(cert) {
  const entries = await getCollection(`${cert}-sources`);
  return entries.map((e) => ({ id: e.id, ...e.data }));
}

/** Every registry key backing a fact in this state, in the order the fact groups declare them. */
export function citedSourceIds(facts) {
  const ids = [];
  for (const group of [facts.exam, facts.criteria]) {
    for (const fact of Object.values(group)) {
      if (fact.source && !ids.includes(fact.source.id)) ids.push(fact.source.id);
    }
  }
  return ids;
}

/** Extra reading no fact cites, sorted by title since nothing numbers these. */
/** @returns {Promise<any[]>} */
export async function loadExtraSources(cert, facts) {
  const entries = await loadSourceEntries(
    cert,
    facts.additionalResources.map((r) => r.id),
  );
  return entries.sort((a, b) => a.title.localeCompare(b.title));
}
