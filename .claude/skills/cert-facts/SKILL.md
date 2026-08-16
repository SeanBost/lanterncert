---
name: cert-facts
description: Research, verify and fill per-state jurisdictional facts for a cert — the { value, source } pairs in src/content/facts/<cert>-facts.json and the registry entries in src/content/sources/<cert>-sources.json. Use when adding a new state, revalidating an existing one, or checking that cited pages still say what we claim. Invoked as /cert-facts <cert-slug> <state|all>.
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

**A null is expensive.** Every field left null is a hole on the state page a reader came for, so
"not found" is a last resort reached after the techniques below are spent — not a first-pass
outcome. Runs are judged on how few honest nulls remain, and a null is only honest once you can name
what you read and why it wasn't there.

## Invocation

```
/cert-facts <cert-slug> <state|all>   full pass over one state, or every state in the cert
/cert-facts <cert-slug> --links       registry sweep only: links, snapshots, drift. No fact work.
/cert-facts <cert-slug> <state> --verify-only   verify what is sourced; do not research nulls
```

`<cert-slug>` is a key in `src/site-config.json` ▸ `testTypes`. `<state>` is a key in
`src/content/states.json`.

## Owns / never touches

**Owns:** `src/content/facts/<cert>-facts.json`, `src/content/sources/<cert>-sources.json`,
`blackbox/source-notes/<cert>-source-notes.json`, `blackbox/source-snapshots/<cert>/`,
`blackbox/research/`.

**The registry is public; the notes are not.** A proposed entry and its note are written together at
the review gate but land in two files — the registry ships in the repo and renders on the site, the
note never leaves `blackbox/`. Never put note-shaped reasoning in a registry field.

**Never touches:** the question bank, any UI or route, `CLAUDE.md`, `blackbox/data-handling.md`,
`blackbox/todo.md`, `blackbox/project-plan.md`, `blackbox/sessions.md`, or git. Surface anything
those need as a report item — **a run that finds a standard wrong or missing proposes the change,
never makes it.**

**Writes on approval:** `src/templates/<cert>-facts-template.json`, and only to add an approved
vocabulary value. Never mid-run, never unapproved.

## Read first

- **`blackbox/data-handling.md` — the authority on every shape and rule.** Registry entry shape,
  key format, source ranking, the source-finding ladder, dating, the fact contract, verification
  checks and verdicts all live there and are **not restated here**. This file covers execution only:
  what a run does, in what order, and where it stops.
- `src/templates/<cert>-facts-template.json` — what every field is for, and the complete set of
  allowed values for each constrained field. **This is the authority on vocabularies.**
- `CLAUDE.md` ▸ *The rules that must never be missed*, ▸ *How it's wired*, ▸ *Locked decisions* —
  why the rules are what they are, and the null / `note` / `stateDetails` reasoning.
- **The most recent report in `blackbox/research/` for this state**, if one exists. It records what
  was already ruled out, and re-running settled research is the cheapest way to waste a pass.
- **A completed state's block in the facts file**, if this state is not the first. It is the
  worked example for how each field is filled, ranged and noted.

## Phases

Run 0–4 without stopping. Stop at 5.

**0 · Preflight.** Load `site-config.json`, `states.json`, the facts file, the sources file and the
template. Resolve the target. If the two owned JSON files have uncommitted changes, say so in the
report — do not refuse.

**1 · Sweep.** `node scripts/audit-sources.mjs <cert> --state <code>` (omit `--state` for `all` or
`--links`). This refreshes any snapshot older than 21 days and reports dangling refs, orphans,
canonical drift and pages whose text changed since last time. **Never fetch a page yourself when a
snapshot under 21 days old exists** — read `blackbox/source-snapshots/<cert>/<key>.json`. Both
snapshot stores are partitioned by cert slug; a new cert gets its directory in
`source-snapshots/` **and** in `source-snapshots-history/`, even though the history one starts
empty. Request volume is deliberately low; every avoidable request is a bot-rule risk taken for
nothing.

The sweep raises two re-dating flags, and both are work items for this run, not noise — see
`data-handling.md` ▸ *Sources — registry* ▸ *Dating a source*:

- **`REDATE`** — the snapshot's `originallyFetched` moved, so this is a new content window: a new
  record, an applied meaningful change, or a retarget. The document moved, so **neither** year
  carries forward. This is the one case where `published` is not immutable.
- **`CURRENCY-STALE`** — the source was re-read this run and its `verifiedCurrentIn` is behind the
  current year. Establish currency properly and set the year; never just bump it.

A one-line tally of everything below the current year prints on every run, including fully cached
ones. **Some entries will sit in that tally indefinitely**, because their currency genuinely cannot
be established from what we hold — a purchase-only document whose seller publishes no edition is the
usual shape. Re-confirm the null against its source note, which records what settling it would
take, and move on. Re-deciding a known null costs a minute; **never invent a year to clear one, and
never suppress a key to silence it** — a suppression list is where a real problem goes to die.

**A changed page is reported, never written** — the sweep prints `CHANGED — awaiting review` and an
`AWAITING REVIEW` block, and leaves the snapshot untouched. That is deliberate: the superseded text
is the change history, and the history is the asset. So a change is a **second review gate, before
the one at step 5**, and it has to be worked rather than noted:

1. Read the stored snapshot and the reported candidate hash. The stored file is still the *old*
   content — that's the point — so re-fetch is not needed to see what we had.
2. Diff them yourself and say in the report **what changed and whether it touches a fact we cite.**
   "The page changed" is not a finding; "the fee table moved from $32 to $34, which backs
   `ga.criteria.dmvCost`" is.
3. Recommend `cosmetic` or `meaningful`, and say why. Cosmetic means the diff carries no
   information — a rotating banner, a build timestamp. Anything touching a cited value, or any
   change you cannot fully account for, is meaningful.
4. **Sean decides.** On approval, apply with
   `--apply-cosmetic <keys>` or `--apply-meaningful <keys>`, comma-separated, and pass
   `--expect-hash <candidate>` so a page that moved again refuses to write. **A `meaningful` apply
   also re-derives `published` and `verifiedCurrentIn` from scratch** — the document moved, so
   neither year carries over. Say in the report what each became and on what evidence.
5. **A page that changed and was not re-read against the fact it backs blocks `dateVerified`.**
   That rule already existed; the sweep now makes it visible instead of trusting memory.

**2 · Verify** — every fact that has a source. Read the snapshot text, find the passage that
supports the stored value, and record the exact quote. A page that loads is not evidence; a passage
is. Apply every check in *Verifying properly* below before calling anything verified — including
check 8, which asks whether a supportable citation is still the *best available* one. Verification
is two questions, not one: does this source back the value, and is it still the right source.

**3 · Discover** — every fact without a source, **and every fact phase 2 could not settle**. Work
*Finding a source* below in order. A fact whose value is already asserted but unsourced (`value`
set, `source` null) belongs here too. Anything still unresolved goes through *Resolve before
escalating* before it may be written up as a question.

**4 · Assemble.** Build the proposed facts block and any proposed registry entries, plus the report.
Before assembling, run the *Pre-assembly checks*.

**5 · REVIEW GATE. Write nothing.** Present the report and the proposed JSON. Wait.

**6 · Apply** — only after approval. Write the facts file, the registry, any approved template
vocabulary, and any snapshots. Bump `meta.dateVerified` to the run date if every sourced fact in
that state was confirmed still accurate to its source this run — reading a snapshot under 21 days
old counts, so a clean sweep over an untouched state qualifies. A partial pass, or any page that
changed and was not re-read against the fact it backs, leaves the date alone.

## Verifying properly

A stored value with a stored source is a **claim**, not a fact.

**Run all nine checks in `data-handling.md` ▸ *Cert facts* ▸ *Verification*** — including check 8,
which asks whether a supportable citation is still the *best available* one, and which runs on
`--verify-only` too. Each has caught a real defect. Record the supporting quote for every fact.

When check 8 proposes a swap, put the reasoning in the report and record the superseded source's
remaining role in its own source note — a demoted source usually still corroborates and should
say so rather than being silently orphaned.

## Finding a source

**Work the eight-step ladder in `data-handling.md` ▸ *Sources — registry* ▸ *Finding a source*, in
order, and stop when the fact is settled.** Rank the candidates it produces with *Choosing between
sources* in the same file. Escalation is step 8 and comes last — say what you already ruled out, so
the question isn't re-answered with work that's already been done.

Choosing between two candidates is a **Decide**, not an *Escalate*. Say why in the source note.

### Fetching discipline

Identity checks, binary handling, snapshot rules and survey keys are in `data-handling.md` ▸
*Sources — fetching and snapshots*. Two things that are judgment rather than rule:

- **Agency outbound links go stale.** A state page may send riders to a programme domain that has
  lapsed or been redirected. When a linked destination fails, find the programme operator's current
  site rather than concluding the programme is unreachable — and record the stale link in the
  referring source's note.
- **A zero-hit search across a whole authority is evidence.** If a complete statute chapter never
  mentions a term, that silence is a finding worth reporting, not a failed search.

## Verdicts

Every fact lands in exactly one of the eight verdicts in `data-handling.md` ▸ *Cert facts* ▸
*Verdicts*.

`blocked` is rare and usually wrong. A PDF is not blocked — `fetch-page.mjs` saves it and extracts
its text layer, and a PDF with no extracted text is scanned, so read the saved file directly. A JS
shell is not blocked either until you have tried the programme's other domains.

## Making calls

Decide it yourself when there is a defensible basis in the sources or in an existing convention.
Escalate only what is genuinely split *after the ladder above is exhausted*. Do not present a menu
where one option is obviously right.

**Decide:** which of two agency pages is the better citation · which of two tiers a source sits in ·
a registry `title` in the house voice · whether a note fact is load-bearing enough to keep ·
whether an inference is documented well enough to be `inferred` rather than `unsupported` · which of
several snapshots best supports a fact · anything the template or `data-handling.md` already answers.

**Escalate:** a new value for a constrained field · `access` on a document whose redistribution
rights are unclear · a fact where two official pages disagree · anything that would overwrite a
stored, sourced value.

Escalated items go in the report's open questions, phrased so one word answers them. Never stop
mid-run to ask.

## Guardrails

**The standing rules are `data-handling.md` ▸ *Universal*** — never invent a citation, never carry a
constrained value across states, never copy source wording, never overwrite a stored sourced value,
never guess `access`. They bind every run; read them there.

Three that govern how a *run* behaves:

- **A constrained field needing a new value stays null** and becomes an end-of-run question. Do not
  add a vocabulary entry to the template mid-run. Do not stop to ask — collect it and keep going.
  Propose the token *and* the evidence for it, so one word can approve both.
- **A page that now disagrees produces `drifted` and a recommendation, never an edit.** The report
  carries the old value, the new value and the quote. Sean decides.
- **Decide what a new registry entry is when you propose it** — a fact's `source` or an
  `additionalResources` key, never both, never neither. An entry cited by nothing is an orphan the
  sweep will flag next run.

## Registry entries

**Shape, key format, `sourceID` assignment, sort order, `title` voice, `access` and both year fields
are in `data-handling.md` ▸ *Sources — registry*.** Build every proposed entry against that section.

Two things that are run behaviour rather than shape:

- **Dating is not optional work on any entry you add or re-read.** Dig for both years and say in the
  report what each became and on what evidence. A `null` on either is explained in the note.
- **Clearing a `CURRENCY-STALE` flag means doing the dating work, not bumping the number.** If it
  cannot be settled, re-confirm the null against its source note and move on.

## Pre-assembly checks

Before writing the report, confirm:

- Every fact you are proposing has its supporting quote, and that quote is in the snapshot of the
  source you are naming.
- Every new registry key is cited exactly once, as a fact source or an `additionalResources` entry,
  and its note (if any) is proposed into `blackbox/source-notes/<cert>-source-notes.json`, not into
  the entry.
- Every new entry carries `state` and a `sourceID` that is the next unused number in the file, and
  sits in its alphabetical position. No `sourceID` is reused, including one freed by a removal.
- Every new or re-dated entry carries both year fields, each derived per `data-handling.md` ▸
  *Dating a source* — not a
  copyright footer, and not the snapshot date. A `null` on either is explained in the note.
- Every range is ascending, same unit, both ends quoted.
- Every remaining null can be justified by naming the authorities read.
- `meta.dateVerified` is bumped only if every sourced fact in the state was confirmed against its
  source this run — cached snapshots count, changed pages must have been re-read.
- Any snapshot written for a page you are not registering is named in the report as evidence.

## Report

Write to `blackbox/research/<cert>-<state>-<YYYY-MM-DD>.md` and give a short summary in the
terminal. If a report for that state and date already exists, suffix the filename rather than
overwriting it — an earlier report may carry the record of what was applied.

Sections, in order:

1. **Header** — cert, state, date, and whether this was a fill, a revalidation or both.
2. **Counts** — facts by verdict; registry entries added/changed; links checked, cached, failed,
   changed; snapshots written/refreshed.
3. **Facts table** — field · value · source key · verdict · supporting quote.
4. **Registry changes** — each added or modified entry with its `access`, both year fields and the
   evidence behind each, and why the source was chosen.
5. **Open questions** — new vocabulary values needing a decision, ambiguous `access`, anything left
   null pending a call. Numbered, each answerable yes/no or with one word.
6. **Detailed notes** — expand every verdict that is not `verified`, plus anything the counts hide.
   Record traps found: a number belonging to a different exam, a stale agency link, a page that
   looked healthy and was not. These are what stop a later pass repeating the work.
7. **Not verified, and why** — the honest residue, naming the authorities read for each null. Never
   omit this section, even when empty.
