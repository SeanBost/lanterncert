---
name: cert-facts
description: Research, verify and fill per-state jurisdictional facts for a cert — the { value, source } pairs in src/content/certs/<cert>-facts.json and the registry entries in src/content/sources/<cert>-sources.json. Use when adding a new state, revalidating an existing one, or checking that cited pages still say what we claim. Invoked as /cert-facts <cert-slug> <state|all>.
---

# cert-facts

Fills and verifies one cert's per-state facts against their cited sources, then stops for review
before writing anything.

Creating a new state and improving an existing one are **the same operation**, applied per fact —
there is no mode to pick. A state where every fact is null is just the case where every fact takes
the "discover" branch.

## Altitude — read this before deciding anything

These facts feed **auto-generated quick-facts content that sends readers to the primary source for
detail**. That fixes the resolution to work at:

- **Honest and traceable is non-negotiable.** Every value ties to a document we hold.
- **Exhaustive is not the goal.** Copy hedges and links out. A fact that tries to capture every
  edge case stops being a quick fact.
- **Record the headline answer.** A genuinely load-bearing exception goes in `meta.note` as a bare
  fact; everything below that threshold is the source's job, not ours.
- **Do not open a schema debate over a detail copy can absorb.** "$250 in-state, $300 out-of-state"
  renders fine as "$250–$300" — that is a note, not a redesign.

The failure mode to avoid is a report full of technically-true objections that change nothing a
reader would see. Report what would make a rider wrong, not what makes the model uneasy.

## Invocation

```
/cert-facts <cert-slug> <state|all>   full pass over one state, or every state in the cert
/cert-facts <cert-slug> --links       registry sweep only: links, snapshots, drift. No fact work.
/cert-facts <cert-slug> <state> --verify-only   verify what is sourced; do not research nulls
```

`<cert-slug>` is a key in `src/site-config.json` ▸ `testTypes`. `<state>` is a key in
`src/content/states.json`.

## Owns / never touches

**Owns:** `src/content/certs/<cert>-facts.json`, `src/content/sources/<cert>-sources.json`,
`blackbox/source-snapshots/`, `blackbox/research/`.

**Never touches:** the question bank, any UI or route, `CLAUDE.md`, `blackbox/todo.md`,
`blackbox/project-plan.md`, `blackbox/sessions.md`, or git. Surface anything those need as a
report item.

## Read first

- `src/templates/<cert>-facts-template.json` — what every field is for, and the complete set of
  allowed values for each constrained field. **This is the authority on vocabularies.**
- `CLAUDE.md` ▸ *The rules that must never be missed*, ▸ *How it's wired*, ▸ *Locked decisions* —
  authority on the registry key format, title voice, the `note` / `stateDetails` split and the
  null rule. Do not restate those rules here; read them there.

## Phases

Run 0–4 without stopping. Stop at 5.

**0 · Preflight.** Load `site-config.json`, `states.json`, the facts file, the sources file and the
template. Resolve the target. If the two owned JSON files have uncommitted changes, say so in the
report — do not refuse.

**1 · Sweep.** `node scripts/audit-sources.mjs <cert> --state <code>` (omit `--state` for `all` or
`--links`). This refreshes any snapshot older than 60 days and reports dangling refs, orphans,
canonical drift and pages whose text changed since last time. **Never fetch a page yourself when a
snapshot under 60 days old exists** — read `blackbox/source-snapshots/<key>.json`. Request volume
is deliberately low; every avoidable request is a bot-rule risk taken for nothing.

**2 · Verify** — every fact that has a source. Read the snapshot text and find the passage that
supports the stored value. Record the exact quote. A page that loads is not evidence; a passage is.
Watch for soft 404s: the sweep reports each page's `title`, and "Page not found" renders as a
perfectly healthy fetch.

PDFs are snapshotted like any other source — `fetch-page.mjs` saves the file to
`blackbox/primary-sources/<key>.<ext>` and extracts its text layer. A PDF whose snapshot has no
text is scanned or image-only; read the saved file directly before calling anything `blocked`.

**3 · Discover** — every fact without a source, **and every fact phase 2 could not settle**.
`WebSearch` for the agency's own page, fetch the best candidate with
`node scripts/fetch-page.mjs <url> --key <proposed-key>`, read it, and propose a registry entry plus
a value. Prefer the agency that issues the credential over any aggregator, and prefer the page that
states the fact over the page that links to it. A fact whose value is already asserted but unsourced
(`value` set, `source` null) belongs here too. Anything still unresolved goes through *Resolve
before escalating* before it may be written up as a question.

**4 · Assemble.** Build the proposed facts block and any proposed registry entries, plus the report.

**5 · REVIEW GATE. Write nothing.** Present the report and the proposed JSON. Wait.

**6 · Apply** — only after approval. Write the facts file, the registry, and any snapshots. Bump
`meta.dateVerified` only if every fact in that state was checked this run.

## Verdicts

Every fact lands in exactly one:

| verdict | meaning |
|---|---|
| `verified` | a passage in the snapshot supports the stored value |
| `inferred` | the source supports the value without stating it, **and the registry note says so** — legitimate, no action. Only reachable after *Resolve before escalating* has been worked; an inference is where research ends up, never where it starts. If the note does not document the inference, it is `unsupported`, and the fix is usually to write the note |
| `drifted` | the page now says something else — **report both values, change nothing** |
| `unsupported` | page is fine, but no passage supports the claim |
| `dead` | link broken, or the page is no longer what was cited |
| `not-applicable` | checked, genuinely does not apply here → `value: null` **with** a source |
| `unresearched` | no source found; stays null |
| `blocked` | could not be fetched by any method |

## Resolve before escalating

**An ambiguity is a research task first and a question second.** Before an inference call or an open
question goes in the report, spend the effort to make it not a question. Work the ladder in order
and stop as soon as one rung settles it:

1. **Re-read the whole page.** The supporting sentence is routinely outside the section it should
   be in — a fee in a sidebar, a prerequisite under a different heading.
2. **Cross-check the snapshots already held.** Costs nothing. A fact about a third party — a
   curriculum, a national program, another agency — is often stated plainly on *that party's* page,
   and the registry may already carry it.
3. **Look for structural corroboration, not just the phrase.** Hour counts, fee components, issued
   artifacts, test formats and program names are all evidence. A page that never writes "MSF" but
   publishes MSF's exact course structure *and* says graduates receive an MSF completion card has
   said it.
4. **Search for a new source.** Issuing agency first, then the program owner, then statute. A new
   registry entry is a normal outcome of this step, not a failure.
5. **Only then escalate** — and say what you already ruled out, so the question isn't re-answered
   with work that's already been done.

This is not optional diligence. GA's `courseType` read as `unsupported` on first pass because the
GMSP page never names the Motorcycle Safety Foundation; rungs 2 and 3 settled it conclusively at
zero request cost. **Escalating it would have handed over work that research could finish.**

## Making calls

Decide it yourself when there is a defensible basis in the sources or in an existing convention.
Escalate only what is genuinely split *after the ladder above is exhausted*. Do not present a menu
where one option is obviously right.

**Decide:** which of two agency pages is the better citation · a registry `title` in the house
voice · whether a `note` fact is load-bearing enough to keep · whether an inference is documented
well enough to be `inferred` rather than `unsupported` · anything the template already answers.

**Escalate:** a new value for a constrained field · `access` on a document whose redistribution
rights are unclear · a fact where two official pages disagree · anything that would overwrite a
stored, sourced value.

Escalated items go in the report's open questions, phrased so one word answers them. Never stop
mid-run to ask.

## Guardrails

- **Never invent a citation.** A page is not a source until its text is in a snapshot and a
  supporting quote is in the report.
- **Be conservative with anything already true.** A stored, sourced fact is never overwritten. If
  the page now disagrees, the verdict is `drifted` and the report carries the old value, the new
  value, the quote and a recommendation. Sean decides.
- **A constrained field needing a new value stays null** and becomes an end-of-run question. Do not
  add a vocabulary entry to the template mid-run. Do not stop to ask — collect it and keep going.
- **`access` is never guessed.** If redistribution rights are unclear, that is a question, not a
  default.
- **Never copy source wording into a value, a note or a title.** Facts are free; expression is not.
- **`value: null` with a source and `value: null` without one mean different things.** Never record
  an unresearched fact as if it were checked and inapplicable.

## Report

Write to `blackbox/research/<cert>-<state>-<YYYY-MM-DD>.md` and give a short summary in the
terminal. Sections, in order:

1. **Header** — cert, state, date, and whether this was a fill, a revalidation or both.
2. **Counts** — facts by verdict; registry entries added/changed; links checked, cached, failed,
   changed; snapshots written/refreshed.
3. **Facts table** — field · value · source key · verdict · supporting quote.
4. **Registry changes** — each added or modified entry with its `access` and why it was chosen.
5. **Open questions** — new vocabulary values needing a decision, ambiguous `access`, anything left
   null pending a call. Numbered, each answerable yes/no or with one word.
6. **Detailed notes** — expand every verdict that is not `verified`, plus anything the counts hide.
7. **Not verified, and why** — the honest residue. Never omit this section, even when empty.
