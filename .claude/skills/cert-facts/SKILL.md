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
`blackbox/source-snapshots/<cert>/`, `blackbox/research/`.

**Never touches:** the question bank, any UI or route, `CLAUDE.md`, `blackbox/todo.md`,
`blackbox/project-plan.md`, `blackbox/sessions.md`, or git. Surface anything those need as a
report item.

**Writes on approval:** `src/templates/<cert>-facts-template.json`, and only to add an approved
vocabulary value. Never mid-run, never unapproved.

## Read first

- `src/templates/<cert>-facts-template.json` — what every field is for, and the complete set of
  allowed values for each constrained field. **This is the authority on vocabularies.**
- `CLAUDE.md` ▸ *The rules that must never be missed*, ▸ *How it's wired*, ▸ *Locked decisions* —
  authority on the registry key format, title voice, the `note` / `stateDetails` split and the
  null rule. Do not restate those rules here; read them there.
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
*Dating a source*:

- **`REDATE`** — the snapshot's `originallyFetched` moved, so this is a new content window: a new
  record, an applied meaningful change, or a retarget. The document moved, so **neither** year
  carries forward. This is the one case where `published` is not immutable.
- **`CURRENCY-STALE`** — the source was re-read this run and its `verifiedCurrentIn` is behind the
  current year. Establish currency properly and set the year; never just bump it.

A one-line tally of everything below the current year prints on every run, including fully cached
ones. **Some entries will sit in that tally indefinitely**, because their currency genuinely cannot
be established from what we hold — a purchase-only document whose seller publishes no edition is the
usual shape. Re-confirm the null against the registry `note`, which records what settling it would
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

A stored value with a stored source is a **claim**, not a fact. Each of these has caught a real
defect; run all of them.

1. **Quote presence is mechanical, not impressionistic.** Before you accept a citation, confirm the
   supporting language is literally in that snapshot — search it for the distinctive strings. A page
   that *points at* the authority is not the authority: a source that says "see the X page for
   complete details" does not support the fact X states, and citing it is `unsupported`.
2. **Check the subject of the sentence, not just the number.** A figure matching the stored value
   may belong to a different exam, credential or fee on the same page. Two exams in one state
   routinely share a threshold. Confirm what the sentence is *about* before accepting it.
3. **Re-derive composed values.** Where a value is assembled from line items, redo the arithmetic
   from the page's own figures. If one end of a range checks out and the other does not, the
   composition is right and the number is wrong.
4. **Check both ends of a range.** A range is two claims. Verify the minimum and the maximum
   separately; a survey that establishes only the low end has not established the range.
5. **Check the fact is about the right path.** Where a state offers parallel routes to the same
   credential, or parallel credentials, confirm the stored value describes the one `meta.localTerm`
   names — not the neighbouring route on the same page.
6. **Compare against a completed state.** Run the same field in a state already finished. A note
   that documents a composition in one state and not another, or a range where a sibling uses a
   single figure, is a defect in one of them.
7. **Discharge standing instructions in registry notes.** Notes carry directives — a year in a URL
   that increments, a figure to re-survey. Do them, and say in the report that you did.
8. **Ask whether the cited source is still the *best* one, not just a working one.** Supporting the
   value is the floor, not the finish. For every fact you verify, weigh the stored citation against
   (a) the other documents already in the registry, (b) anything in `blackbox/primary-sources/`, and
   (c) what a short search suggests the agency now publishes. Rank with *Choosing between sources*.
   Propose the swap when a better one exists, with the reasoning in the report and the superseded
   source's role recorded in its own registry `note` — a demoted source usually still corroborates
   and should say so rather than being silently orphaned.
   Four things that make a working citation the wrong one, each of which has caught a real defect:
   - **It infers where another document states.** A course page implying a curriculum loses to the
     state manual naming it outright.
   - **Its URL pins an edition.** A dated path like `/uploads/2020/03/` is a citation frozen to one
     print, and agencies publish over them without redirecting. Prefer a canonical current-document
     endpoint; check for a newer revision whenever a document carries a revision code.
   - **It is a landing page, a mirror, or an abridgement rather than the document.** Confirm what you
     are citing actually *is* the thing — an HTML edition can omit a whole section the PDF carries,
     and a quick-reference form number is not the full handbook.
   - **A more specific document now exists.** Cert-level or national sources are placeholders for
     state ones; re-check for a state-published equivalent rather than assuming none appeared.
   **This runs on every verify pass, including `--verify-only`.** A citation that was right two runs
   ago quietly stops being right, and nothing else in this workflow looks for that.
9. **Re-date every source you touch.** Confirming the passage is still there does not confirm the
   document is still the current one — work *Dating a source* and update `verifiedCurrentIn`, or
   leave it and say in the report why it could not be established. An entry the sweep flags
   `CURRENCY-STALE` is asking for exactly this.

## Finding a source

Worked in order. Stop when the fact is settled.

1. **Re-grep everything already held.** Every new question gets searched across *all* snapshots for
   the cert, not just the ones fetched for that field. Documents acquired for one purpose routinely
   answer another, and this costs nothing. A large PDF fetched three questions ago is still on disk.
2. **Check the parent credential.** A specialty credential normally inherits the base credential's
   rules, so a fact absent from the motorcycle pages often lives on the general licence pages —
   licence term, minimum age, application process and testing procedure especially. Establish the
   inheritance ("M1 is a class of driver's licence") and the general rule reaches it.
3. **Prefer the manual over the summary.** Agencies publish the same topic twice: a short web
   summary and a handbook or manual section. The manual is more procedurally complete and is where
   counts, thresholds and rules-in-force actually appear. Look for it before concluding a fact is
   unpublished.
4. **Follow every cross-reference the document names.** "As defined by Section X", "see the Y page",
   "approved under Z standard" — the authority is one hop away and the document just told you where.
   Follow it rather than searching afresh.
5. **Search for the phrase, never guess the identifier.** Do not guess statute section numbers, rule
   chapter numbers or URL slugs; each miss is a wasted request. Search for the sentence you expect
   the document to contain, or for the fact plus the agency, and let the result name the identifier.
6. **Read aggregators for direction, never for citation.** Practice-test sites, forums and Q&A pages
   are not sources and are never cited — but they are useful for learning *where* an agency publishes
   something. Mine them for the pointer, then take the fact from the agency page. Treat their
   disagreement with each other as a signal they are inferring, not reporting.
7. **Follow a delegation to its end.** Where a state delegates to a programme, contractor or external
   standard, follow the chain through every link before concluding. "No single answer exists" is a
   finding that carries the same burden of proof as a value: name each authority you followed and
   what it did and did not specify.
8. **Only then escalate** — and say what you already ruled out, so the question isn't re-answered
   with work that's already been done.

### Choosing between sources

The ladder above finds candidates; this ranks them. A `source` is a promise the reader can go check
it, so **accessibility and clarity rank alongside authority, not below it**. Most to least preferred
— `CLAUDE.md` ▸ *Locked decisions* is authoritative if this list and that one ever drift:

1. openly accessible government source, readable and clear
2. openly accessible source from a body the government granted authority — MSF, a state's program
   contractor — readable and clear
3. openly accessible government source, dense or legalese but unambiguous
4. openly accessible authorized-third-party source, dense or legalese but unambiguous
5. primary source from either that is paywalled, purchase-only or otherwise not freely accessible
6. primary source where the fact must be pieced together or assumed from context

**A rule of thumb, not a tiebreak algorithm.** It orders the usual case. When several sources cover
one value, make the call and say why in the registry `note` — that is a *Decide*, not an *Escalate*.

Working notes:
- **A lower tier is not disqualified.** Tiers 5 and 6 back real facts today. The tier is a reason to
  look for something better *first*, not a reason to reject what you have.
- **Prefer the higher tier only when it says the same thing as well.** A tier-1 page that states the
  fact loosely loses to a tier-3 statute that states it exactly. Clarity is inside each tier.
- **Rank 6 is last because inference rots.** It's the only tier a later revalidation cannot re-check
  by reading one sentence, which is why `inferred` requires the note to spell out the reasoning.
- **Tier 5 needs its access recorded.** A purchase-only or restricted document is citable and never
  hostable — set `access` accordingly and never quote it verbatim on-site.
- **Non-primary sources are never any tier.** Attorney pages, journalism, practice-test sites and
  forums do not appear on this ladder at all; see step 6 above for the only use they have.

### Fetching discipline

- **Verify page identity on every fetch, before reading it for facts.** Check the title and the
  first lines. Three failures look like success: a **soft 404** (HTTP 200, "Page not found" title), a
  **metadata page** on a legal or regulatory site that lists a rule's history instead of its text,
  and a **JS shell** that renders a few hundred characters of chrome and no content. Delete the
  snapshot of a soft 404 rather than leaving it under a key you want.
- **Agency outbound links go stale.** A state page may send riders to a programme domain that has
  lapsed or been redirected. When a linked destination fails, find the programme operator's current
  site rather than concluding the programme is unreachable — and record the stale link in the
  referring source's note.
- **A zero-hit search across a whole authority is evidence.** If a complete statute chapter never
  mentions a term, that silence is a finding worth reporting, not a failed search.
- **Provider surveys are legitimate and bounded.** Where an agency publishes no price, survey the
  rates providers in its directory publish, quote each one from a snapshot, and document the survey
  in the registry note. Snapshot survey pages under a `<state>-survey-<provider>` key; they are
  evidence, not registry entries. Never build a range from a search-engine summary.

## Verdicts

Every fact lands in exactly one:

| verdict | meaning |
|---|---|
| `verified` | a passage in the snapshot supports the stored value |
| `inferred` | the source supports the value without stating it, **and the registry note says so** — legitimate, no action. Only reachable after *Finding a source* has been worked; an inference is where research ends up, never where it starts. If the note does not document the inference, it is `unsupported`, and the fix is usually to write the note |
| `drifted` | the page now says something else — **report both values, change nothing** |
| `unsupported` | page is fine, but no passage supports the claim |
| `dead` | link broken, or the page is no longer what was cited |
| `not-applicable` | checked, genuinely does not apply here → `value: null` **with** a source |
| `unresearched` | no source found; stays null |
| `blocked` | could not be fetched by any method |

`blocked` is rare. A PDF is not blocked — `fetch-page.mjs` saves it to `blackbox/primary-sources/`
and extracts its text layer, and a PDF with no extracted text is scanned, so read the saved file
directly. A JS shell is not blocked either until you have tried the programme's other domains.

## Making calls

Decide it yourself when there is a defensible basis in the sources or in an existing convention.
Escalate only what is genuinely split *after the ladder above is exhausted*. Do not present a menu
where one option is obviously right.

**Decide:** which of two agency pages is the better citation (*Choosing between sources*) · which of
two tiers a source sits in · a registry `title` in the house
voice · whether a `note` fact is load-bearing enough to keep · whether an inference is documented
well enough to be `inferred` rather than `unsupported` · which of several snapshots best supports a
fact · anything the template already answers.

**Escalate:** a new value for a constrained field · `access` on a document whose redistribution
rights are unclear · a fact where two official pages disagree · anything that would overwrite a
stored, sourced value.

Escalated items go in the report's open questions, phrased so one word answers them. Never stop
mid-run to ask.

## Guardrails

- **Never invent a citation.** A page is not a source until its text is in a snapshot and a
  supporting quote is in the report.
- **Never carry a constrained value across states.** Neighbouring states running similar programmes
  routinely differ, and a wrong `courseType` or `requirementType` silently scopes content to the
  wrong riders. Verify the token against this state's own documents every time, and expect states to
  need values the vocabulary does not yet have.
- **A constrained field needing a new value stays null** and becomes an end-of-run question. Do not
  add a vocabulary entry to the template mid-run. Do not stop to ask — collect it and keep going.
  Propose the token *and* the evidence for it, so one word can approve both.
- **Be conservative with anything already true.** A stored, sourced fact is never overwritten. If
  the page now disagrees, the verdict is `drifted` and the report carries the old value, the new
  value, the quote and a recommendation. Sean decides.
- **`access` is never guessed.** If redistribution rights are unclear, that is a question, not a
  default.
- **Never copy source wording into a value, a note or a title.** Facts are free; expression is not.
- **`value: null` with a source and `value: null` without one mean different things.** Never record
  an unresearched fact as if it were checked and inapplicable.
- **Every registry entry must be cited by something.** A new entry is either a fact's `source` or an
  `additionalResources` key. An entry cited by nothing is an orphan the sweep will flag, so decide
  which it is when you propose it, and never list a key in `additionalResources` that a fact already
  cites.

## Registry entry shape

Every entry carries these properties, in this order:

```json
"ca-dmv-instruction-permits": {
  "state": "CA",
  "sourceID": "0042",
  "title": "CA DMV Instruction and Learner's Permit Guide",
  "publisher": "California Department of Motor Vehicles",
  "url": "https://...",
  "access": "public",
  "published": null,
  "verifiedCurrentIn": 2026,
  "note": "..."
}
```

- **`state`** is the uppercase state code — `FL`, `GA`, `TX`, `CA` — or **`multi`** for anything
  scoped `xx-`. Redundant with the key prefix by design: it makes the file filterable and groupable
  without parsing keys.
- **`sourceID`** is a zero-padded four-digit string, assigned in ascending order of addition.
  **Take the next number not yet used in the file, and never reuse one** — a retired entry's number
  stays retired, so gaps are expected and correct. It is a stable handle that survives a key being
  renamed or an entry being re-scoped.
- **`published`** and **`verifiedCurrentIn`** are the two year fields — see *Dating a source* below,
  which is not optional work.
- **`note`** is the only optional property; omit the key entirely when there is nothing to record.

### Dating a source

Two years, because vintage and currency are different questions. A 2020 manual still operative in
2026 is ordinary, and one number cannot say both. **Neither year is a formality — dig for each, and
record what you dug through.** `CLAUDE.md` ▸ *How it's wired* is authoritative if these drift.

**`published` — the year the content itself was last published**, as a number, or `null` for a
living page that states none.

- Take it from the document's own dating: a revision code in a form footer, a revision-history table,
  an edition statement, a "does not reflect changes after…" line, a statute's amendment note, a
  compilation year in the title, a served filename carrying an update month.
- **A site-wide copyright footer is never a publication date.** It appears on every page of the site
  and says nothing about when that page's content was written. This is the single most tempting
  wrong answer; `null` is correct and honest instead.
- Where a document gives a range, take the first year.
- For a statute, date the operative text, not the page — the amendment that produced the current
  wording, which can be decades before the page you read it on.
- Corroborate where you can. A revision table agreeing with a PDF's embedded creation date beats
  either alone, and both beat the date in an upload path, which records when a file was posted
  rather than when it was written.

**`verifiedCurrentIn` — the most recent year you established this is still the operative version**,
or `null` if you genuinely could not.

- **This is not "the fetch succeeded."** An unchanged file at a pinned URL proves the file is
  unchanged, never that the publisher still calls it current. Do not derive this year from the
  snapshot date.
- What actually establishes it, strongest first:
  1. a regulator or agency naming the document, by name and year, in something read this year
  2. an agency's canonical current-document endpoint serving exactly this file
  3. a generic, non-edition-stamped filename — the one a publisher overwrites on a new edition —
     returning identical bytes
  4. the publisher's own index or library still listing it as current
- A dated `/uploads/YYYY/MM/` path establishes nothing by itself. Neither does a third-party mirror.
- **`null` is a real answer and often the right one.** If the only evidence is that a product page
  sells *a* document of that name, you have not established the edition. Write `null`, and put in
  the note what settling it would take.
- Where a document is older than the current year, say in the note what carried it forward. That
  sentence is what a later pass re-checks instead of redoing the search.

**Both years are re-derived, never carried, whenever a source's content changes.** Approving a
`meaningful` snapshot change means the document moved — re-read both, and say in the report what
each became. Re-checking `published` alone is the trap: a document can keep its publication year and
quietly stop being current. The sweep flags any entry whose `verifiedCurrentIn` is below the current
year as `CURRENCY-STALE`; clearing one means doing the work above, not bumping the number.

**The file is sorted alphabetically by key.** Insert a new entry at its alphabetical position, not
at the end and not beside the entry that prompted it. Sort order is by key, which means entries
group by state prefix as a side effect — that grouping is incidental, so never hand-order within it.

## Pre-assembly checks

Before writing the report, confirm:

- Every fact you are proposing has its supporting quote, and that quote is in the snapshot of the
  source you are naming.
- Every new registry key is cited exactly once, as a fact source or an `additionalResources` entry.
- Every new entry carries `state` and a `sourceID` that is the next unused number in the file, and
  sits in its alphabetical position. No `sourceID` is reused, including one freed by a removal.
- Every new or re-dated entry carries both year fields, each derived per *Dating a source* — not a
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
