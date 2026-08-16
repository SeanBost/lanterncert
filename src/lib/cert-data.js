// Loading helpers shared by every cert/state route. Cert-agnostic: collection names are built from
// the cert slug, which is the registry key, the URL segment and the filename stem all at once.
import { getCollection, getEntry } from "astro:content";
import siteConfig from "../site-config.json";
import states from "../content/states.json";

export const site = siteConfig.site;
export const certs = siteConfig.testTypes;

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
    // Derived from the facts collection, not states.json — a cert only gets pages for the states it
    // has data for, so adding a state to states.json can't publish an empty page.
    const facts = await getCollection(`${cert}-facts`);
    for (const entry of facts) paths.push({ params: { cert, state: entry.id } });
  }
  return paths;
}

// Collection names are built from the cert slug, so TS can only infer a union across every
// collection. The shape is guaranteed by the Zod schema at build time instead.
/** @returns {Promise<any>} */
export async function loadState(cert, state) {
  const entry = await getEntry(`${cert}-facts`, state);
  return entry?.data ?? null;
}

/**
 * Splits a state's registry keys into the two lists the page renders separately: documents backing
 * a fact, and extra reading no fact cites. A key is never in both — the schema enforces it.
 */
/** @returns {Promise<{ cited: any[], extra: any[] }>} */
export async function loadSources(cert, facts) {
  const cited = new Set();
  for (const group of [facts.exam, facts.criteria]) {
    for (const fact of Object.values(group)) if (fact.source) cited.add(fact.source.id);
  }
  const extra = facts.additionalResources.map((r) => r.id);

  const hydrate = async (ids) => {
    const entries = await Promise.all(ids.map((id) => getEntry(`${cert}-sources`, id)));
    return entries
      .filter(Boolean)
      .map((e) => ({ id: e.id, ...e.data }))
      .sort((a, b) => a.title.localeCompare(b.title));
  };

  return { cited: await hydrate([...cited]), extra: await hydrate(extra) };
}
