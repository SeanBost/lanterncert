# FreeCertPractice

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
    certs/               per-state exam params, criteria and resource refs, one file per cert
    sources.json         registry of cited documents (metadata only, not the documents)
    questions/           the question bank
  pages/                 routes
public/                  static assets, copied verbatim
scripts/                 build tooling
```

---

## Moto Endorsement States & Exam Parameters

| State | Questions | Time Limit | Passing Score |
|-------|-----------|------------|---------------|
| FL    | TBD       | TBD        | TBD           |
| GA    | TBD       | TBD        | TBD           |
| TX    | TBD       | TBD        | TBD           |
| CA    | TBD       | TBD        | TBD           |

Parameters come from official state DMV sources only. See `src/content/certs/motorcycle.json`.

---

## Study Modes *(planned)*

- **Flashcards** — topic-based, shuffle, mark known
- **Practice** — untimed, instant feedback and explanation
- **Mock Exam** — timed, state-specific configuration, end-of-test scoring with wrong-answer review

---

## Legal

Content is intended for test preparation only and originates from publicly available sources. Not
official DMV material. Verify current requirements and answers with your state DMV before testing.
