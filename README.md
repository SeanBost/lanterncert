# LanternCert

A free, no-signup certification-prep site at [lanterncert.com](https://lanterncert.com).

A static Astro build: no backend, no database, no accounts. Pages are generated at build time from
JSON content files, and what deploys is HTML, CSS, and a small amount of client JS for the study
modes.

**Status: pre-alpha.** Scaffold and content pipeline are in place, and the deploy pipeline is live -- 
what's published is a placeholder page, not a completed product. A WIP version as I build is live at [lanterncert.com/homepage-to-come](https://lanterncert.com/homepage-to-come/)

## Stack
- **Astro**, a static site generator with built-in validation, builds to `/dist`
- JSON content + `.astro` components
- Free Cloudflare Pages hosting, Github-hooked
- GA4 with custom events *(planned)*

## Commands
```bash
npm install      # first time only; requires Node 24 (see .nvmrc)
npm run dev      # dev server at http://localhost:4321
npm run build    # static build into /dist
npm run preview  # serve the built /dist locally
```

Check builds with `npm run preview` rather than opening `/dist/index.html` directly, since absolute
asset paths break over `file://`.

`npm run build` also archives a dated zip of `/dist` into `/builds` via the `postbuild` hook. It's a
local version record, gitignored, and the script no-ops on CI.

## Structure
```
src/
  site-config.json   site identity + the registry of certifications
  content/
    states.json      state identity, keyed by slug — cert-independent
    facts/           per-state jurisdictional facts, one file per cert
    sources/         registry of cited documents (metadata, not the documents)
    topics/          the subject taxonomy each question is classified against
    questions/       the question bank
  templates/         each cert's data shape, annotated — the vocabulary reference
  pages/             routes
public/              static assets, copied verbatim
scripts/             content-research tooling
```

## How it's put together

A certification is a slug, like `motorcycle-endorsement`, and that slug is the registry key, the URL
segment, and the stem of every file belonging to that cert. Adding a certification means adding
files, not rewriting routes. Anything true of a state regardless of cert lives once, in
`states.json`, and joins on the key.

Every jurisdictional fact is stored as a `{ value, source }` pair rather than a bare value, so
provenance is per fact instead of per page: a changed agency page is a one-line diff, and each fact
can be hyperlinked to the document that backs it. Sources are registered as documents, and a
citation naming a document that isn't in the registry is intended to fail the build rather than ship.

Exam parameters are recorded as each agency actually publishes them, including when that's *not at
all*. A missing value stays null instead of being filled with a plausible one, and a structure that
doesn't flatten cleanly, like an exam scored per section rather than overall, keeps its structure.

## Sourcing

Facts come from official agency documents and nothing else. No attorney pages, no journalism, no
competing practice-test sites. Questions and explanations are written fresh rather than paraphrased
from a manual.

`scripts/` holds the research tooling: a fetcher that renders through local headless Chrome and
extracts text from PDFs, and an auditor that re-fetches every cited page on a 21-day cycle and
reports what changed. Snapshots are stored locally and gitignored - the registry publishes metadata
about documents, never the documents.

Each state's facts carry the date they were last verified, and that date is meant to be visible to
readers rather than buried in a repo.

## Deploy
Push to `main`. Cloudflare Pages watches the repo, runs `npm run build` on its own builders, and
publishes `/dist`. `.nvmrc` pins Node 24 so their build matches local.

## Legal
This is free exam-preparation material assembled from publicly available sources. Not official 
agency material. Verify current requirements with your state's licensing agency.

## You are currently reading this
That's really awesome. Please tell me about it: seantbost@gmail.com
