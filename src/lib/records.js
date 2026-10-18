// Hosted agency records: each entry's metadata paired with the one fragment its page and download render.
// data-handling.md ▸ Sources — registry ▸ Hosted records.
import { getCollection } from "astro:content";
import { certs, escapeHtml, loadAllSources, site } from "./cert-data.js";
import { formatDate } from "./format-fact.js";

const fragments = import.meta.glob("../content/records/*.html", {
  query: "?raw",
  import: "default",
  eager: true,
});

/** @returns {Promise<{ id: string, data: import("astro:content").CollectionEntry<"records">["data"], html: string }[]>} */
export async function loadRecords() {
  const records = await getCollection("records");
  return records.map((record) => {
    const html = fragments[`../content/records/${record.id}.html`];
    if (html === undefined) {
      throw new Error(`records: ${record.id} has no fragment at src/content/records/${record.id}.html`);
    }
    return { id: record.id, data: record.data, html };
  });
}

export const recordPath = (id) => `/records/${id}`;
export const downloadPath = (id) => `/records/${id}/${id}.html`;

const RECORD_PATH = /^\/records\/([^/]+)\/?$/;

/** The record id a registry url points at on this site, or null for anywhere else. */
function hostedRecordId(url) {
  const { host, pathname } = new URL(url);
  return host === new URL(site.url).host ? (pathname.match(RECORD_PATH)?.[1] ?? null) : null;
}

/** Multi-state records after every state, then newest first within a state. */
const byStateThenNewest = (a, b) =>
  (a.state === "multi") - (b.state === "multi") ||
  a.state.localeCompare(b.state) ||
  b.record.data.date.localeCompare(a.record.data.date);

export const recordStateLabel = (state) => (state === "multi" ? "Multi-state" : state);

/**
 * Each displayed cert's records, placed by the registry entry citing them; an uncited or missing one fails the build.
 * @returns {Promise<{ cert: Record<string, any>, entries: { record: any, state: string }[] }[]>}
 */
export async function recordsByCert() {
  const records = new Map((await loadRecords()).map((record) => [record.id, record]));
  const cited = new Set();
  const groups = [];

  for (const cert of Object.values(certs)) {
    const entries = new Map();
    for (const source of await loadAllSources(cert.slug)) {
      const id = hostedRecordId(source.url);
      if (id === null) continue;
      if (!records.has(id)) throw new Error(`records: ${source.id} points at ${recordPath(id)}, which has no record`);
      cited.add(id);
      entries.set(id, { record: records.get(id), state: source.state });
    }
    if (cert.displayOnSite && entries.size > 0) {
      groups.push({ cert, entries: [...entries.values()].sort(byStateThenNewest) });
    }
  }

  const uncited = [...records.keys()].filter((id) => !cited.has(id));
  if (uncited.length > 0) throw new Error(`records: no registry entry cites ${uncited.join(", ")}`);
  return groups;
}

/** The caption's words before its date, shared so the page and the download read alike. */
export const captionLead = ({ artifactTitle, agency }) => `${artifactTitle} from the ${agency}, received`;

/** The fragment as a standalone document, styled inline so it reads the same opened from disk. */
export function recordDocument(record) {
  const { artifactTitle, date } = record.data;
  const url = new URL(recordPath(record.id), site.url).href;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(artifactTitle)}</title>
<link rel="canonical" href="${url}">
<style>
body { max-width: 44rem; margin: 2rem auto; padding: 0 1rem; font-family: system-ui, sans-serif; line-height: 1.6; }
p, dl, dd, blockquote { margin: 0; }
main > div > * + *, blockquote > * + * { margin-top: 1rem; }
img { display: block; }
dl { display: grid; grid-template-columns: max-content minmax(0, 1fr); column-gap: 1rem; padding-bottom: 1rem; border-bottom: 1px solid; }
dt { font-weight: 600; }
dd { overflow-wrap: anywhere; }
footer { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid; font-size: 0.875rem; }
</style>
</head>
<body>
<main>
${record.html.trim()}
</main>
<footer>
<p>${escapeHtml(captionLead(record.data))} ${formatDate(date)}. Redacted copy published at <a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>.</p>
</footer>
</body>
</html>
`;
}
