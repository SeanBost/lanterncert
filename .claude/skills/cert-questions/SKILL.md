---
name: cert-questions
description: Author exam questions and their Study Guide facts for a cert — the entries in src/content/questions/<cert>-questions.json, drafted from a primary source passage and stopped for review before anything is written. Use when filling a topic's quota, working a newly registered document, or building out a state's bank. Invoked as /cert-questions <cert> --source <key> or /cert-questions <cert> <state>.
---

# cert-questions

Turns a primary source into questions, each one carrying its Study Guide fact, then stops for review
before writing anything.

## Altitude — read this before deciding anything

**The bank is the most expensive artifact in this project and the hardest to fix later.** A wrong
fact here contributes to a failed test and to unsafe riding, and unlike a state fact it is not one
row in a panel — it is a claim a rider will study, believe and act on.

- **Per-question citation is the wedge.** Every question carries a `source`, a `sourceSection` and an
  explanation that stands on its own. Competitors cite at the page level and date their content; the
  differentiator is being right at the level of the individual item.
- **Quality over quantity, always.** The quota is a floor to be met honestly, never a number to hit.
  **Nine good questions and a declared gap beats ten with one guess in it.**
- **Depth over speed, per question.** A run that produces six carefully built questions is a good
  run. A run that produces twenty shallow ones has created work, not content — every one of them
  will be re-read at review, and the ones that are wrong are the expensive kind of wrong.

**The failure mode this skill exists to prevent is fluent, plausible, unsourced content.** Questions
are the easiest thing here to generate and the hardest to verify, because a wrong one reads exactly
like a right one. Everything below is built so that producing a question *requires* having read the
passage behind it.

## Invocation

```
/cert-questions <cert> --source <source-key>   one registered document, worked end to end
/cert-questions <cert> <state>                 every teachable source that state resolves
/cert-questions <cert> <state> --topic <slug>  the same, narrowed to one topic's quota
/cert-questions <cert> --resume                continue the most recent worklist for this cert
```

**`--source` is worked to exhaustion, and that usually takes several runs.** A manual yields far more
candidates than one gate can carry, so the expected shape is one `--source` run followed by
`--resume` until no chunk is `working` and nothing is `queued`. **`--resume` authors off the
candidate ledger and does not re-enumerate** a chunk the previous run already worked.

`<cert>` is a `certTypes` key in `src/site-config.json` **or its `slugShort`** — `mot` and
`motorcycle-endorsement` are the same argument. `<state>` is a key in `src/content/states.json`.
`<source-key>` is a key in the cert's sources registry.

**Chunking inside a document is this skill's business, never the invocation's.** A manual is far too
large for one pass, so a run splits it by the document's *own* contents and works the chunks in
order. The worklist at phase 1 is where that breakdown is proposed and where it can be steered — say
which chunk to start from there rather than reaching for a finer flag.

## Owns / never touches

**Owns:** `src/content/questions/<cert>-questions.json`, `public/assets/questions/<credit>/`,
`blackbox/working-materials/question-art/`, `blackbox/research/`.

**Writes on approval only:** `src/content/guide/<cert>-guide.json` — and only to add or edit a
group's `heading`, `leadIn` or `media`. **An `opener` is Sean's prose**; propose wording, never
overwrite it.

**Never touches:** the facts file, the sources registry, `src/content/topics/`,
`src/content/weights/`, `src/content/exams/`, any UI or route, `CLAUDE.md`,
`blackbox/data-handling.md`, `blackbox/todo.md`, `blackbox/project-plan.md`,
`blackbox/sessions.md`, or git.

**A run that needs one of those proposes the change and continues.** Three cases will come up:
- **The best source for a question is not in the registry.** Registering is `/cert-facts`'s job.
  Name the document and the questions it would unblock, and author what you can without it.
- **Material has no honest topic.** Report it as a proposed topic — §4b rule 6 says be generous
  while the taxonomy is still free to move — and do not stretch an existing topic to fit.
- **A topic's weight looks wrong for what the source actually tests.** Report it. A weight change
  moves every other topic's quota, so it is never a side effect of an authoring run.

## Read first

- **`blackbox/data-handling.md` ▸ *Questions* (§5) and ▸ *Study Guide* (§4c)** — the authority on
  every shape and rule, **not restated here.** This file covers execution only: what a run does, in
  what order, and where it stops. §5 rule 4 and 4a govern scope, rule 13 the quota, §4c the guide.
- **`CLAUDE.md` ▸ *The three modes*, ▸ *The rules that must never be missed*, ▸ *Conventions*** — the
  reasoning, the voice rules, and the test/exam split that binds every stem you write.
- **The existing bank.** Read every question in the topic you are about to author for, in full. It is
  the worked example, and it is the only way to know what is already covered.
- **`blackbox/research/motorcycle-endorsement-mom-diff-2026-08-31.md`** for this cert — §3 is the
  override register and §4 the terminology register. **Both are scope decisions already made**;
  re-deriving them by hand is how a state-scoped value gets widened by accident.
- **The most recent report in `blackbox/research/` for this source or state.** It records what was
  ruled out, what was deferred and why.

## Phases

Run 0–4 without stopping. Stop at 5.

**0 · Preflight.** Resolve the cert and target. Load the bank, the topics, the weights, the guide
scaffold and the registry. Run `node scripts/audit-questions.mjs <cert>`. If the bank has uncommitted
changes, say so in the report; do not refuse.

**Then decide which of the two run modes you are in, because they have different briefs.**

- **`--source` is EXHAUSTION mode. The candidate ledger is the brief**, and the run is finished when
  every candidate in every chunk holds a terminal verdict. **The quota is reported and does not
  steer.** A topic already over its floor is not a reason to stop reading a document — the quota is
  a floor, never a target *(§5 rule 13)*, and the expensive thing is reopening a source later, not
  authoring one more question while it is open.
- **`<state>` is QUOTA mode. The quota table is the brief**: it says which topics are short and by
  how much, and the run works toward those floors across whatever sources the state resolves.

**The failure this split prevents is real and has happened.** Reading the quota table as the brief on
a `--source` run ends it the moment one topic passes its floor, leaving the rest of the document
unread and every remaining candidate to be re-enumerated in some later session.

**1 · Worklist.** Enumerate what this run will read, and write it to
`blackbox/research/<cert>-worklist-<target>-<YYYY-MM-DD>.md` before authoring anything.

- For `--source`: the document's own table of contents, as chunks, in document order.
- For `<state>`: every registry key that state resolves — its fact sources, its
  `additionalResources`, and the cert-wide `multi` entries — each with a one-line read of what it
  teaches. **A fee schedule teaches nothing and gets one line saying so.** That is not wasted work:
  the worklist doubles as the record of what was examined, which is what answers *"did anything
  testable get missed?"*

**The worklist is the resumability mechanism.** Mark each chunk `pending`, `working`, `worked`, or
`barren` with a reason, and update it as the run proceeds so `--resume` can pick up mid-document.
**`working` means enumerated but not yet exhausted** — some candidate in it is still `queued`. A
chunk reaches `worked` only when every one of its candidates holds a terminal verdict.

**THE WORKLIST CARRIES A CANDIDATE LEDGER, NOT JUST CHUNK STATUSES.** Once a chunk is enumerated at
phase 3, every candidate goes into the worklist under that chunk with its verdict, and for a `queued`
one, the scope already verified for it. **`--resume` then authors straight off the ledger instead of
re-enumerating**, which is the whole point: enumeration is expensive, it is the step that surfaces
awkward material, and redoing it per gate invites quietly skipping whatever was hard last time.

- **Write the ledger at phase 3, before authoring**, and update each entry's verdict at phase 6.
- **A `queued` entry carries its verified scope**, so a resuming run does not re-grep four manuals to
  rediscover what this run already established.
- **The ledger gets long, and that is correct.** It is the resumability record and the answer to
  *"did anything testable get missed?"*; both jobs need every candidate, not a count.

**2 · Read one chunk.** Read the passage in full from the snapshot at
`blackbox/source-snapshots/<cert>/<key>.json`, never from memory and never from a summary. **Never
fetch a page in this skill** — a snapshot under 21 days old is the source of truth, and refreshing
one is `/cert-facts`'s job.

**3 · Enumerate candidates before writing anything.** List every testable fact in the chunk, as a
flat list, *before* authoring a single question. Then assign each one a verdict.

**This ordering is the point.** Enumerating first is what surfaces the material that is genuinely
tested but awkward to write; authoring first means you write the easy items and never notice the
rest. **A candidate list shorter than the passage deserves is the first sign a run is coasting.**

**4 · Author, one question at a time.** Work the candidate list in order, following *Authoring one
question* below. **Finish each question completely before starting the next.**

**5 · REVIEW GATE. Write nothing.** Present the report and the proposed JSON. Wait.

**6 · Apply** — only after approval. Write the bank with targeted edits, update the worklist, and
write any approved guide-scaffold changes.

**7 · Art** — only after approval, and only for questions that were approved. *Question art* below.

### How much a gate carries

**Eight to twelve questions, and never more than fifteen.** The gate exists to be read carefully by a
person; a gate carrying thirty questions gets skimmed, and a skimmed gate is worse than no gate
because it launders unreviewed content as reviewed. A large chunk becomes several gates.

**The cap bounds the GATE, never the reading.** Enumerate the whole chunk however many candidates it
yields, author up to the cap, and mark the rest `queued` with their scope verified. **The cap is
about a reviewer's attention and nothing else** — it is not a reason to leave a document unread, to
shorten a candidate list, or to move to a different chunk before this one is exhausted.

## Authoring one question

**Per question, in this order. Do not batch these steps across questions** — drafting four stems and
then filling in four explanations produces four shallow questions, every time. The order is the
quality mechanism.

1. **Quote the passage.** Copy the exact sentence or sentences the question rests on, verbatim, into
   the review table. **If you cannot quote it, you cannot ask it.** This is the same rule as §1.1 for
   facts, and it is what makes review *"is this answerable from this text?"* rather than *"is this
   true?"*
2. **Decide scope, and say why.** Default to the narrowest honest scope — a single state. Widening
   to an umbrella requires reading the *same* fact in every document that umbrella reaches and
   naming them in the report. §5 rule 4: anything carrying a number, a statute or a named procedure
   is state-scoped, **however the document spells it**.
3. **Write the stem.** It must be answerable with the choices covered up — a stem that only makes
   sense once you have read the options is a recognition test, not a knowledge one. Name the state
   in the stem whenever the scope is a single state (§5c).
4. **Write the choices.** Then run *The distractor bar* below.
5. **Write the explanation.** It asserts, it does not argue (§5 rule 6b). **Then read it with the
   question hidden**: if it does not teach something on its own, it is not finished, because this
   sentence is also the Study Guide fact.
6. **Write the guide block** — `kind`, `label`, `order`, and `text` only where the guide wants it
   shorter than the explanation. Leave `group: null` unless the material obviously clusters;
   grouping is a later pass and is deliberately not a precondition (§4c rule 3).
7. **Write `sourceSection`.** A locator, capped at 90 characters, that points and never explains.
   **Write it now, while the document is open** — it is a nightmare to backfill.
8. **Fill `meta` honestly.** `note` carries anything a reviewer would otherwise have to rediscover:
   an inferential step, a rejected alternative answer, a document that nearly disagreed.
9. **Re-read the passage one final time against the finished question.** This catches the specific
   failure where a question drifts from its source while being polished.

### The distractor bar

Distractors are where questions break, and both directions are failures:

- **A distractor that is obviously wrong makes the question free.** No joke options, no options a
  rider would never consider.
- **A distractor that is arguably right makes the question broken.** For each one, you must be able
  to name what in the passage rules it out. **Record that rebuttal in the review table.**
- **This rebuttal is an authoring artifact and never ships.** §5 rule 6b keeps it out of the
  explanation; it exists so review can see the question is sound. The two are not in conflict.

Mechanical tells, all of which give the answer away:

- The correct answer is the longest, most qualified, or most detailed option.
- Options differ in grammatical form, tense or length.
- Absolute words (*always*, *never*, *only*) appear in distractors but not the key.
- *All of the above* / *none of the above* — **never use either.**
- A negative stem (*which is NOT*) — avoid unless the source frames it that way.

### Voice

The stem and choices are copy a reader sees, so the house rules bind: **no "we", "us" or "our"**,
sentence case, **hyphens rather than em or en dashes**, US spelling, and **"test" is ours while
"exam" is theirs**. Never copy source wording — read for the fact, close the document, write from
understanding. If your sentence tracks theirs, rewrite it (§6 rule 1).

## Verdicts

**Every candidate from phase 3 lands in exactly one**, and every one appears in the ledger and the
report. A candidate list where everything is `authored` usually means the list was written to match
what was easy to write.

**Five are terminal; `queued` is not.** That distinction is what makes exhaustion checkable: a chunk
is `worked` when nothing in it is `queued`, and a source is finished when no chunk is `working`.

- **`authored`** — a question was written for it.
- **`re-angled`** — already covered; authored as a sister of an existing question and linked through
  `sisterQuestions`. Only after the topic's genuinely distinct material is exhausted (§5 rule 13).
- **`covered`** — already in the bank; nothing written.
- **`queued`** — **NOT TERMINAL.** Testable, scope already verified, and waiting only on gate
  capacity. **It takes no blocker, because nothing is blocking it** — the next gate authors it.
  Record the verified scope alongside it so a resuming run inherits that work.
- **`deferred`** — testable, but genuinely **blocked**. Name the blocker. FL's following-distance
  contradiction is the worked example, and a deferral that is a standing decision belongs in
  `blackbox/authoring/<cert>-exclusions.json` so the audit reads it as declared rather than missing.
- **`rejected`** — not exam-relevant, or not testable in four options. Say which.

**Never write "gate cap" as a blocker on a `deferred` item.** That conflates *the run ended* with
*something is wrong*, and it is what the split exists to prevent: one of those clears itself on the
next run and the other needs a decision or an external event. Running out of gate is `queued`.

## Making calls

**Decide:** which of several true facts is worth a question · how to word a stem · which distractors
to use · whether a fact is one question or two · `kind` and `label` on a guide block · whether a
question needs art · whether a candidate is `rejected` or `deferred` · anything §5 or §4c already
answers.

**Escalate:** any question whose correct answer depends on an inference the source does not state ·
two held documents disagreeing on a fact · widening a scope where one covered state's document is
silent rather than agreeing · a fact that seems to require a topic that does not exist · a source
that appears to have changed since its snapshot.

Escalated items go in the report's open questions, phrased so one word answers them. **Never stop
mid-run to ask.**

## Guardrails

**The standing rules are `data-handling.md` ▸ *Universal*.** Six that govern how a *run* behaves:

- **Never reserialize the bank.** `JSON.stringify(bank, null, 2)` expands every choice from one line
  to four and silently reformats the whole file. **Edit by hand or with targeted string replacement
  carrying a match-count assertion**, and verify the one-line choice form survived before reporting.
  This has gone wrong more than once, including while this skill was being written.
- **Write from understanding, never from another text.** Read the passage, close it, then write the
  question. If a sentence tracks the source's, rewrite it. **Facts are free to restate and expression
  is not** (§6 rule 1), and the risk is highest with whatever was read most closely — a cited
  manual's phrasing is as easy to echo as anyone else's.
- **Only primary agency documents are ever cited** (§1 rule 2). Material read for orientation rather
  than citation — a survey, an aggregate, a landscape review — informs **what is worth asking about**
  and never supplies a stem, an answer or a turn of phrase.
- **Never write a term no held document uses.** SIPDE and RiderRadar appear in none of the manuals;
  *pennant* appears in the MUTCD and not in Georgia's Driver's Manual. A term nobody publishes cannot
  be cited, so it cannot be asked (§5 rule 4a).
- **Never write a TRADEMARKED term as content** (§6 rule 10). **`T-CLOCS℠` and `SEE` are the live
  cases** — both MSF curriculum terms, barred from stems, choices, explanations, guide facts and
  `sourceSection` alike. **Test the practice, never the name**: the inspection is a set of facts, the
  mnemonic packaging them is MSF's property, and a rider is tested on the behavior rather than the
  acronym. **Naming an organization or a document in order to cite it stays allowed.** Note this bars
  a term the document *does* use, where rule 4a bars one no document uses — a term can fail either.
- **Never quote a `purchase` or `restricted` document** (§6 rule 5). It may inform understanding; it
  may not be reproduced, and it is a weak citation for a rider who cannot open it.
- **Never invent an id.** The trailing number counts sitewide, is never reused, and `meta.idKey` must
  equal it. Read the bank for the highest number in use and continue from there.

## Question art

**Only after approval, and only for approved questions.** Standards are `data-handling.md` §5 rules
9–9e; per-image recipes live in `blackbox/working-materials/question-art/recipes.md`.

- **Class A** reproduces an artifact a rider meets on the road — always SVG, the artifact's own
  colors, accuracy is the whole job. **Class B** explains something — always a transparent PNG at
  800x600, LanternCert palette, **no baked-in text ever**.
- **`alt` describes the image and never its meaning**, and is checked against the *choices*: it is
  only safe if it leaves every option still plausible (§5 rule 9b).
- **Every image gets a recipe entry**, element by element, with every number marked SPEC, MEASURED or
  EYE. **Art is reused across questions**, so never name a file after a question id.
- **Build the generator at the third sign of a cert, not before** — knobs at the top, one script
  emitting every sign, the shape `brand/mark.mjs` already proved.

## Pre-assembly checks

Before writing the report, confirm:

- Every question carries a verbatim passage quote, and that quote is in the snapshot of the source it
  names.
- Every distractor has a recorded rebuttal, and none of the mechanical tells above is present.
- Every explanation reads as a standalone fact with the question hidden.
- Every `sourceSection` is under 90 characters, points rather than explains, and carries no claim.
- Every scope wider than one state names the documents checked, one per covered state.
- Every id is `<slugShort>-<scope>-<topicNum>-<sitewideNum>`, its segments agree with the fields they
  name, `idKey` equals the trailing number, and no number is reused.
- Every `sisterQuestions` list is symmetric, single-scope, and carries at most one `guide` block
  across the set.
- Every `media.src` names a file that will exist by the time the bank is written, filed under its
  `imageCredit`.
- Every candidate from phase 3 has a verdict **in the ledger**, every `deferred` names its blocker,
  and every `queued` carries its verified scope. No `deferred` blames gate capacity.
- `node scripts/audit-questions.mjs <cert>` was run against the proposed bank and its output is in
  the report — **including any new NOTE this run introduces.**

## Report

Write to `blackbox/research/<cert>-questions-<target>-<YYYY-MM-DD>.md` and give a short summary in
the terminal. Suffix rather than overwrite an existing report for the same target and date.

Sections, in order:

1. **Header** — cert, target, date, which chunks were worked, and where the worklist stands.
   **On a `--source` run, say how much of the document remains**: chunks `worked` / `working` /
   `pending`, and how many candidates are still `queued`. That is the run's own progress bar, and
   without it nobody can tell a finished source from an abandoned one.
2. **Counts** — candidates by verdict; questions by topic and scope; quota movement per state, before
   and after; art required. **Quota movement is reported in both modes and steers only in quota
   mode** — on a `--source` run it is a consequence, not a target.
3. **The questions** — one block each, carrying: the proposed JSON, **the verbatim source passage**,
   the distractor rebuttals, and the scope decision with the documents checked. **This is the section
   the review actually happens in**, so it is written for reading, not for skimming.
4. **Guide impact** — which sections gained facts, which groups are proposed, what still renders
   ungrouped.
5. **Open questions** — numbered, each answerable in one word.
6. **Not authored, and why** — every `deferred` and `rejected` candidate with its reason, and every
   `queued` one listed separately as the next gate's work. **Never omit this section, even when
   empty**; it is the record that the passage was worked rather than mined for whatever was easiest.
   **Keep `queued` visibly apart from `deferred`** — one is a backlog and the other is a set of
   problems, and a reader who cannot tell them apart cannot tell whether a source is nearly done.
