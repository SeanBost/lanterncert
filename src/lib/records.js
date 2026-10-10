// Hosted agency records: each entry's metadata paired with the one fragment its page and download render.
// data-handling.md ▸ Sources — registry ▸ Hosted records.
import { getCollection } from "astro:content";
import { escapeHtml, site } from "./cert-data.js";
import { formatDate } from "./format-fact.js";

const fragments = import.meta.glob("../content/records/*.html", {
  query: "?raw",
  import: "default",
  eager: true,
});

/** @returns {Promise<{ id: string, data: Record<string, string>, html: string }[]>} */
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

const recordPath = (id) => `/records/${id}`;
export const downloadPath = (id) => `/records/${id}/${id}.html`;

/** The caption's words before its date, shared so the page and the download read alike. */
export const captionLead = ({ artifactTitle, agency }) => `${artifactTitle} from the ${agency}, sent`;

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
