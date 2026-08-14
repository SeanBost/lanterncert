# LanternCert

Free, no-signup motorcycle endorsement test prep — architected to scale to additional states and
test types.

**Status: pre-alpha.** The scaffold is in place; no site yet, no domain, nothing deployed.

---

## Tech Stack

- **Framework:** [Astro](https://astro.build) — static, mobile-first, minimal client JS
- **Hosting:** [Cloudflare Pages](https://pages.cloudflare.com) *(planned)*
- **Content:** JSON, validated at build time *(schema approach being finalized)*
- **Progress storage:** localStorage, versioned schema, no accounts *(planned)*
- **Analytics:** GA4 with custom events *(planned)*

No backend. No database. No auth.

---

## Getting Started

Requires Node 24 (see `.nvmrc`).

```bash
npm install
npm run dev        # dev server at localhost:4321
```

```bash
npm run build      # production build into /dist
npm run preview    # serve the built /dist locally
```

`npm run build` also drops a dated zip of `/dist` into `/builds` as a local version record.
That's local-only — `/builds` is gitignored and the script no-ops on CI.

Check builds with `npm run preview`, not by opening `/dist/index.html` directly — `file://` breaks
absolute asset paths.

---

## Structure

```
src/
  site-config.json       site identity + test type registry
  content/
    states.json          state identity, keyed by state code
    certs/               per-state meta, exam params and criteria, one file per cert
    sources/             registry of cited documents (metadata only, not the documents)
    questions/           the question bank
  templates/             each cert's data shape, annotated — the field and vocabulary reference
  pages/                 routes
public/                  static assets, copied verbatim
scripts/                 build and content-research tooling
```

---

## Moto Endorsement States & Exam Parameters

| State | Questions | Time Limit | Passing Score | Sectioned |
|-------|-----------|------------|---------------|-----------|
| FL    | 25 *      | none published | — *       | — *       |
| GA    | 40 †      | none published | 75% †     | yes †     |
| TX    | — ‡       | — ‡        | — ‡           | — ‡       |
| CA    | not published | none published | 80%   | no        |

\* Florida administers no motorcycle-specific test — this is the MSF Basic RiderCourse knowledge
test, and how many sittings it involves depends on the delivery option a course provider runs. Its
passing score sits in MSF instructor materials rather than any public source.
† Georgia's exam is two 20-question sections requiring 15 correct on **each**; the flat figures
above can't express the per-section gate, which is what the sectioned column flags.
‡ Texas requires a safety course of every applicant and waives the state knowledge test on
completion, so in practice no rider sits a state exam — and the course test varies by school,
because Texas approves curricula against a federal standard rather than mandating one.

**No agency in any of the four states publishes an exam time limit.** Three of the four publish a
closing-time cutoff instead ("not within 30 minutes of closing"), which is a different thing.

Every value is stored with its own citation, and each cited page is re-fetched and re-read on a
60-day cycle. Parameters come from official state sources only. See
`src/content/certs/motorcycle-endorsement-facts.json`.

---

## Study Modes *(planned)*

- **Flashcards** — topic-based, shuffle, mark known
- **Practice** — untimed, instant feedback and explanation
- **Mock Exam** — timed, state-specific configuration, end-of-test scoring with wrong-answer review

---

## Legal

Content is intended for test preparation only and originates from publicly available sources. Not
official DMV material. Verify current requirements and answers with your state DMV before testing.
