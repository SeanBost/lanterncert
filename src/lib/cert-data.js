// Loading helpers shared by every cert/state route. Collection names are built from the cert slug.
import { getCollection, getEntry } from "astro:content";
import siteConfig from "../site-config.json";
import states from "../content/states.json";

export const site = siteConfig.site;
export const certs = siteConfig.testTypes;

// The build gate for site-config.json, which gets no Zod pass. data-handling.md ▸ Site config.
for (const [key, config] of Object.entries(certs)) {
  for (const field of ["name", "slug", "blurb"]) {
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
