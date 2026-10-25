# LanternCert

A free, no-strings certification-prep site at [lanterncert.com](https://lanterncert.com).

**Watch it get built:** [lanterncert.com/homepage-to-come](https://lanterncert.com/homepage-to-come/)

**Status: near-alpha.** An initial version of test content and infra is almost ready; what's
published at the root domain is a placeholder, not the finished product.

## What it is

Everything a rider needs to earn their state motorcycle endorsement in one place, free. The first
build covers **Florida, Georgia, Texas and California**, and the architecture treats a certification
as data rather than code, so more states and more cert types drop in without rewriting routes.

The offering is a dynamic written guide on the process for earning a given cert in a given state,
followed by an exam-prep product with three deliberately progressive tools:

- **Study Guide** - a crash course in what the state's exam actually asks about
- **Practice Cards** - the whole question bank, untimed and unscored
- **Mock Test** - the same bank under that state's own exam conditions: its question count, its
  passing score, its time limit, plus topical weighting

Every guide claim and question/answer cites the agency document it came from and gets linked
on-page. For the foreseeable future, there are no ads, signups, or upsells; growing a userbase and
goodwill is the core focus this early. More targeted growth directions can be determined with
more data.

## Sourcing

Facts come from official agency documents and nothing else. Questions and explanations are written
fresh rather than paraphrased from a manual.

**Unavailable information is an opportunity to build authority:** California's motorcycle
knowledge test question count wasn't available online, so I filed a CA Public Records Act request
and published the CA DMV's response at
[lanterncert.com/records/ca-dmv-req-2026-3933](https://lanterncert.com/records/ca-dmv-req-2026-3933/),
then cited it like any other document.

**Agentic digging enables rapid research and authoring:** skills in `.claude/skills/` run
streamlined procedures the same way every time and stop at a human review gate with a report
before anything gets plugged in.

`scripts/` holds research and audit tooling: a fetcher that renders through local headless
Chrome and extracts text from PDFs, a source auditor that re-fetches every cited page on a
~monthly cycle and reports what changed, and a question auditor that validates the bank.

Snapshots of fetched documents are stored locally and gitignored. The registry publishes metadata
about documents, never the documents. Users are encouraged to click through to primary sources for
full pictures.

## How it's put together

A certification is a slug, like `motorcycle-endorsement`, and that slug is the registry key, the URL
segment, and the stem of every file belonging to that cert. A question is written once against the
manual it comes from and reaches every state whose manual descends from it, resolved at build time.

Every jurisdictional fact is stored as a `{ value, source }` pair rather than a bare value, so
provenance is per fact and each gets hyperlinked to the document that backs it.

Sources are registered as documents, and a citation naming a document that isn't in the registry
fails the build rather than shipping. So does a fact with a value but no source. Exam parameters
are recorded as each agency actually publishes them, including when that's *not at all*; a missing
value stays null.

## Stack

- **Astro**, a static site generator with built-in content validation, builds to `/dist`
- **JSON content** + `.astro` components, validated at build time against a per-cert schema
- Free Cloudflare Pages hosting, GitHub-hooked
- GA4 with custom events *(planned)*

No backend, no database, no accounts. What deploys is HTML, CSS, and a small amount of client JS for
the study modes.

## Structure

```
src/
  site-config.json     site identity + the registry of certifications
  content/             all site data, one file per cert wherever it's cert-specific
    states.json        state identity, keyed by slug - cert-independent
    sources/           registry of cited documents (metadata, not the documents)
    records/           agency correspondence, hosted so it can be cited
    facts/             per-state jurisdictional facts
    exams/             each agency's published exam conditions
    topics/            the subject taxonomy each question is classified against
    weights/           how heavily a state tests each topic
    questions/         the question bank, along with each question's metadata and explanations
    guide/             Study Guide copy
    intro/             the state-page article copy: cert-specific and dynamically filled per state
    display/           the user-facing phrasing that each coded fact value maps to
  content.config.ts    the content collections and the checks that span files
  schemas/             the content contract every file is validated against
  lib/                 build-time helpers: the joins, formatters and resolvers
  pages/               routes
  layouts/             page shells
  components/          the shared UI pieces
  scripts/             browser JS, loaded per page
  styles/              global.css - the design tokens, then everything built from them
functions/             edge functions - the visitor's state, to prefill the state search
public/                static assets, copied verbatim
scripts/               content-research, audit and render-check tooling
.claude/skills/        the research, authoring and audit workflows
```

## Deploying

Push to `main`. Cloudflare Pages watches the repo, runs `npm run build` on its own builders, and
publishes `/dist`. `.nvmrc` pins Node 24 so their build matches local.

## Legal stuff

This is free exam-preparation material assembled from publicly available sources. Not official
agency material. Not endorsed by any official agency. Verify current requirements with your
state's licensing agency.

A working privacy and usage policy can be found at
[lanterncert.com/about/#privacy](https://lanterncert.com/about/#privacy).

If you'd like to copy and mess around with the basic structure for a project of your own, go for
it! Up to commit `2b36e43`, everything tracked is under an MIT license. For work beyond that, all
rights are reserved.

## You are currently reading this

That's really awesome. Please tell me about it: seantbost@gmail.com
