# LanternCert

A free, no-strings certification-prep site at [lanterncert.com](https://lanterncert.com).

**Watch it get built:** [lanterncert.com/homepage-to-come](https://lanterncert.com/homepage-to-come/)

## What it is

Everything a rider needs to earn their state motorcycle endorsement in one place, free. The first
build covers **Florida, Georgia, Texas and California**, and the architecture treats a certification
as data rather than code, so more states and more cert types drop in without rewriting routes.

The offering is a dynamic written guide on the process for earning a given cert in a given state,
followed by an exam-prep product with three deliberately progressive tools/features:

- **Study Guide** - a crash course in what the state's exam actually asks about
- **Practice Cards** - the whole question bank, untimed and unscored
- **Mock Test** - the same bank under that state's own exam conditions: its question count, its
  passing score, its time limit, with basic topical weighting

Every guide claim and question/answer cites the agency document it came from, every jurisdictional
fact carries the date it was last verified against that document, and both are visible to the
reader and linked on-page. For the foreseeable future, there's no ads, no signup, and no upsell, since
focusing on developing a user base to build SEO/AEO/Forum goodwill and incrementally test/improve content is worth
more than a cash-in this early. More targeted growth directions can be determined with more data.

**Status: pre-alpha.** The scaffold, content pipeline and deploy pipeline are all live; what's
published at the root domain is a placeholder, not a finished product.

## How it's put together

A certification is a slug, like `motorcycle-endorsement`, and that slug is the registry key, the URL
segment, and the stem of every file belonging to that cert. Adding a certification means adding
files, not rewriting routes. Anything true of a state regardless of cert lives once, in
`states.json`, and joins on the key.

Every jurisdictional fact is stored as a `{ value, source }` pair rather than a bare value, so
provenance is per fact instead of per page: a changed agency page is a one-line diff, and each fact
can be hyperlinked to the document that backs it. Sources are registered as documents, and a
citation naming a document that isn't in the registry fails the build rather than shipping.

Exam parameters are recorded as each agency actually publishes them, including when that's *not at
all*. A missing value stays null instead of being filled with a plausible one, and a structure that
doesn't flatten cleanly, like an exam scored per section rather than overall, keeps its structure.

About everything needed to assemble the site, including presented data, is here on this GitHub page. 
Some metadata and contextual nuances shaping the collection, validation, and product direction are not.

## Sourcing

Facts come from official agency documents and nothing else. No attorney pages, no journalism, no
competing practice-test sites. Questions and explanations are written fresh rather than paraphrased
from a manual.

`scripts/` holds the research and audit tooling: a fetcher that renders through local headless
Chrome and extracts text from PDFs, a source auditor that re-fetches every cited page on a
~monthly cycle and reports what changed, and a question auditor that validates the bank offline -
scope, citations, answer keys, and whether each state's weighting can actually fill a test.

I'm still presented with content reports that I personally review and hand-edit before anything
gets plugged in, so all of the tedium and 90% of the workload is stripped from the process without
removing the human touch, verification, and accountability that users deserve from an educational
product. This is the core reason I chose motorcycle endorsement as cert #1 despite it being a niche
and effectively unmonetizable choice -- I ride and am certified myself, so I can catch errors that
might otherwise slip by me/AI tools as I build the systems and content shapes from zero.

Snapshots of fetched documents are stored locally and gitignored. The registry publishes metadata
about documents, never the documents. Users are encouraged to click-through to primary sources for
full pictures.
## Stack

- **Astro**, a static site generator with built-in content validation, builds to `/dist`
- JSON content + `.astro` components, validated at build time against a per-cert schema
- Free Cloudflare Pages hosting, GitHub-hooked
- GA4 with custom events *(planned)*

No backend, no database, no accounts. What deploys is HTML, CSS, and a small amount of client JS for
the study modes.

## Structure

```
src/
  site-config.json   site identity + the registry of certifications
  content/           every piece of site data as JSON, one file per cert per directory
    states.json      state identity, keyed by slug - cert-independent
    facts/           per-state jurisdictional facts
    sources/         registry of cited documents (metadata, not the documents)
    topics/          the subject taxonomy each question is classified against
    questions/       the question bank
    exams/           each agency's published exam conditions
    weights/         how heavily a state tests each topic
    guide/           Study Guide copy
    intro/           the state-page lede: one template per cert, filled per state
    display/         the reader-facing wording each coded fact value maps to
  schemas/           the content contract every file is validated against
  lib/               build-time helpers: the joins, formatters and resolvers
  layouts/           page shells
  components/        the shared UI pieces
  pages/             routes
  scripts/           browser JS, loaded per page
  styles/            global.css - the design tokens, then everything built from them
public/              static assets, copied verbatim
scripts/             content-research and audit tooling
```

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

## Deploy

Push to `main`. Cloudflare Pages watches the repo, runs `npm run build` on its own builders, and
publishes `/dist`. `.nvmrc` pins Node 24 so their build matches local.

## License

MIT, in [LICENSE](LICENSE). The code is MIT; the agency documents it cites belong to the agencies
that published them.

## Legal

This is free exam-preparation material assembled from publicly available sources. Not official
agency material. Verify current requirements with your state's licensing agency.

A working privacy and usage policy can be found at [lanterncert.com/about/#privacy](https://lanterncert.com/about/#privacy)

## You are currently reading this

That's really awesome. Please tell me about it: seantbost@gmail.com
