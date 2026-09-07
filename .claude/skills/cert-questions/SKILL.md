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

- **Per-question citation is the standard.** Every question carries a `source`, a `sourceSection` and
  an explanation that stands on its own. **The bar is being right at the level of the individual
  item**, which is also why a question cannot be written without its passage in front of you.
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
group's `heading`, `leadIn` or `media`. **An `opener` is hand-written prose**; propose wording, never
overwrite it. Also `blackbox/authoring/<cert>-exclusions.json`, where an approved deliberate gap is
declared — **a gap only, never owed work**, which belongs in the worklist ledger.

**Never touches:** the facts file, the sources registry, `src/content/topics/`,
`src/content/weights/`, `src/content/exams/`, any UI or route, `CLAUDE.md`,
`blackbox/data-handling.md`, `blackbox/authoring/<cert>-standards.md`, `blackbox/todo.md`,
`blackbox/strategy/project-plan.md`, `blackbox/sessions.md`, or git.

**A run that needs one of those proposes the change and continues.** Four cases will come up:
- **The best source for a question is not in the registry.** Registering is `/cert-facts`'s job.
  Name the document and the questions it would unblock, and author what you can without it.
- **Material has no honest topic.** Report it as a proposed topic — §4b rule 6 says be generous
  while the taxonomy is still free to move — and do not stretch an existing topic to fit.
- **A topic's weight looks wrong for what the source actually tests.** Report it. A weight change
  moves every other topic's quota, so it is never a side effect of an authoring run.
- **A cert ruling is owed** — a scope instance, a newly barred term, a source that behaves oddly.
  **Propose it at gate A; never write the standards file.** Same posture as `data-handling.md`, and
  for the same reason: a run that edits the rules it is judged against has stopped being reviewable.

## Read first

- **`blackbox/authoring/<cert>-standards.md`** — **this cert's own rulings**, and the first thing to
  read on a run. Scope instances, barred terms, which sources are independent texts. `data-handling.md`
  owns the rule; **this file owns which cases it has already been applied to**, and a run that skips it
  re-derives a scope decision already made.
- **`blackbox/data-handling.md` ▸ *Questions* (§5) and ▸ *Study Guide* (§4c)** — the authority on
  every shape and rule, **not restated here.** This file covers execution only: what a run does, in
  what order, and where it stops. §5 rule 4 and 4a govern scope, rule 13 the quota, §4c the guide.
- **`CLAUDE.md` ▸ *The three modes*, ▸ *The rules that must never be missed*, ▸ *Conventions*** — the
  reasoning, the voice rules, and the test/exam split that binds every stem you write.
- **The existing bank.** Read every question in the topic you are about to author for, in full. It is
  the worked example, and it is the only way to know what is already covered.
- **Any source-diff or override register the cert has**, named from its standards file. **Those are
  scope decisions already made**; re-deriving one by hand is how a state-scoped value gets widened
  by accident.
- **The most recent report in `blackbox/research/` for this source or state.** It records what was
  ruled out, what was deferred and why.

## Phases

**Two gates, and they are different jobs.** Gate A settles decisions — scope architecture, run
policy, anything with a consequence beyond one question. Gate B reviews questions. **Never mix
them**: a design call and a distractor call are read in different modes, and a report carrying both
forces a reviewer to switch on every paragraph.

Run 0–1 without stopping. Stop at 2. Then run 3–5 without stopping. Stop at 6.

**0 · Preflight.** Resolve the cert and target. Load the bank, the topics, the weights, the guide
scaffold and the registry. Run `node scripts/audit-questions.mjs <cert> --resolve`, which is the
run's starting picture: the quota, and what each state already reads. If the bank has uncommitted
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

**1 · Worklist and scope reconnaissance.** Enumerate what this run will read, and write it to
`blackbox/research/<cert>-worklist-<target>-<YYYY-MM-DD>.md` before authoring anything.

- For `--source`: the document's own table of contents, as chunks, in document order.
- For `<state>`: every registry key that state resolves — its fact sources, its
  `additionalResources`, and the cert-wide `multi` entries — each with a one-line read of what it
  teaches. **A fee schedule teaches nothing and gets one line saying so.** That is not wasted work:
  the worklist doubles as the record of what was examined, which is what answers *"did anything
  testable get missed?"*

**THEN DO THE SCOPE RECONNAISSANCE, BEFORE READING A SINGLE PASSAGE.** Work out which umbrellas can
carry this document's content and which states each one reaches, and **name every state the document
cannot honestly reach at all**. It costs one pass over the exams file and one grep per state, and it
is what turns a mid-run surprise into a decision taken before any work rests on it.

- **A state the document cannot reach owes variants, and that is a decision, not a discovery.** It
  goes to gate A. **Finding this out mid-authoring is the failure** — by then questions are already
  written against scopes that skip the state, and the answer is usually already recorded.
- **Read the cert's standards file and its diff or override register first**; both are scope work
  already done, and re-deriving it by hand is how a state-scoped value gets widened by accident.
- Record the reconnaissance in the worklist as a short table: umbrella, states reached, bar to widen.

**The worklist is the resumability mechanism.** Mark each chunk `pending`, `working`, `worked`, or
`barren` with a reason, and update it as the run proceeds so `--resume` can pick up mid-document.
**`working` means enumerated but not yet exhausted** — some candidate in it is still `queued`. A
chunk reaches `worked` only when every one of its candidates holds a terminal verdict.

**THE WORKLIST CARRIES A CANDIDATE LEDGER, NOT JUST CHUNK STATUSES.** Once a chunk is enumerated at
phase 4, every candidate goes into the worklist under that chunk with its verdict, and for a `queued`
one, the scope already verified for it. **`--resume` then authors straight off the ledger instead of
re-enumerating**, which is the whole point: enumeration is expensive, it is the step that surfaces
awkward material, and redoing it per gate invites quietly skipping whatever was hard last time.

- **Write the ledger at phase 4, before authoring**, and update each entry's verdict at phase 7.
- **A `queued` entry carries its verified scope**, so a resuming run does not re-grep four manuals to
  rediscover what this run already established.
- **The ledger gets long, and that is correct.** It is the resumability record and the answer to
  *"did anything testable get missed?"*; both jobs need every candidate, not a count.

**2 · GATE A — DECISIONS BRIEF. Nothing is written outside `blackbox/research/`.** Present the
brief and wait. *The decisions brief*
below has its shape. **If reconnaissance surfaced no decisions, say so in one line and continue
without stopping** — an empty gate is a gate nobody reads next time.

**3 · Read one chunk.** Read the passage in full from the snapshot at
`blackbox/source-snapshots/<cert>/<key>.json`, never from memory and never from a summary. **Never
fetch a page in this skill** — a snapshot under 21 days old is the source of truth, and refreshing
one is `/cert-facts`'s job.

**4 · Enumerate candidates before writing anything.** List every testable fact in the chunk, as a
flat list, *before* authoring a single question. Then assign each one a verdict.

**This ordering is the point.** Enumerating first is what surfaces the material that is genuinely
tested but awkward to write; authoring first means you write the easy items and never notice the
rest. **A candidate list shorter than the passage deserves is the first sign a run is coasting.**

**5 · Author, one question at a time.** Work the candidate list in order, following *Authoring one
question* below. **Finish each question completely before starting the next.**

**A decision that surfaces here is appended to the brief, never folded into the question report.**
Keep authoring around it — author what does not depend on the answer, and leave what does as
`deferred` naming the open decision as its blocker. The brief is re-presented at gate B, read first
and separately.

**6 · GATE B — QUESTION GATE. Nothing is written outside `blackbox/research/`.** Present the report
and the proposed JSON. Wait.

**TWO JSON FILES SIT BESIDE THE REPORT, and each has a different job.**

- `<report-stem>-PROPOSED.json` — the new questions alone, in splice-ready form. **A fragment with no
  outer braces**, so it does not parse on its own; that is deliberate, and it is what phase 7 splices.
- `<report-stem>-PROPOSED-full-bank.json` — the whole bank as it would look after. **It parses, and
  it is what `--proposed` and `--resolve` are run against.** Build it as a copy of the bank with the
  fragment inserted — **never by reserializing**, which destroys the one-line choice form.

**7 · Apply** — only after approval. Write the bank with targeted edits, update the worklist, and
write any approved guide-scaffold changes.

**8 · Art** — only after approval, and only for questions that were approved. *Question art* below.

### The decisions brief

**One file per run**, at `blackbox/research/<cert>-decisions-<target>-<YYYY-MM-DD>.md`, opened at
phase 1 and appended to whenever authoring surfaces something. It carries **decisions only** — the
question report carries no design calls at all.

**What belongs in it:** anything whose consequence outlives the question that surfaced it. Scope
architecture, a new umbrella, a state the source cannot reach, run policy, a proposed topic or weight
change, a standards question, a vocabulary gap. **What does not:** a distractor, a stem, a `kind`,
whether one fact is one question or two. Those are *Making calls* and they are yours.

**Keep it to one page.** A brief nobody can hold in their head is a report wearing a different name.
Three decisions well framed beat nine listed.

Each item, numbered and in this shape:

- **The call** — one sentence, phrased as a question with an answer.
- **Options** — two or three, one line each. Never a single option with a rationale.
- **Recommendation** — which, and the one thing that decides it.
- **Consequence** — **what changes downstream, stated as an outcome and not as a token.** Which
  riders read which fact, which files move, what the audit says afterwards. *"GA riders get no
  helmet-fastening fact until a variant exists"* is a consequence; *"scoped `MNS2011`"* is not.
- **Reversibility** — cheap to change later, or baked into ids and stored progress.

**A rule cited here carries its content, not just its number.** `§5 rule 4` means nothing at review
speed against a thousand-line file; *"§5 rule 4 — anything carrying a number or a statute is
state-scoped"* can be judged on sight. **Numbers alone are for the archive; the brief is for a
reader.** Cite at most a handful; a brief leaning on ten rules is explaining a system rather than
asking for a decision.


### How much gate B carries

**Eight to twelve questions, and never more than fifteen.** The gate exists to be read carefully by a
person; a gate carrying thirty questions gets skimmed, and a skimmed gate is worse than no gate
because it launders unreviewed content as reviewed. A large chunk becomes several gates.

**Gate A has its own cap and it is much smaller** — one page, three or four decisions. The two caps
measure different things: gate B bounds how much content a reader can check, gate A how many open
calls a reader can hold at once.

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
8. **Fill `meta` honestly, and leave `note` null unless it holds a bare fact no field can**
   (§1 rule 9). **It is not a review record.** Scope evidence, rejected alternatives, who decided
   what and when, and why a field is null all belong to the report, the decisions brief and
   `sessions.md` — a note repeating them is a second owner that goes stale silently and ships
   inside tracked content. **If it reads like an argument, it is in the wrong file.**
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
understanding. If your sentence tracks theirs, rewrite it (§6 rule 1). **The tell is a clause you
could not have written with the document shut**: its structure, its distinctive verb, its ordering of
a list. A shared technical noun is fine; a shared shape is not, and **the choices are where it slips
through** — a distractor lifted off a bulleted list carries that list's phrasing intact.

**It also has to read as written rather than produced**, because a reader judges the bank without
ever seeing how it was made. Assert the fact and stop: no restating the stem before answering it, no
*it is important to note*, no reflexive *not X but Y*, no third parallel clause added for rhythm, and
none of *crucial*, *vital*, *ensure*, *utilize*, *leverage*, *robust*. **The audit catches sameness
across a topic and you cannot see it from inside one question** — which is the argument for writing
each explanation as the fact demands rather than to a template you are carrying between them.

## Verdicts

**Every candidate from phase 4 lands in exactly one**, and every one appears in the ledger and the
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
- **`deferred`** — testable, but genuinely **blocked**. Name the blocker. A source contradicting
  itself is the worked example, and a deferral that is a standing decision belongs in
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

**Escalated items go in the decisions brief, never in the question report.** Frame each one as
*The decisions brief* asks: options, a recommendation, and the consequence stated as an outcome.
**Never stop mid-run to ask** — author around it and let the gate settle it.

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
- **Never write a term no held document uses.** A term nobody publishes cannot be cited, so it
  cannot be asked (§5 rule 4a). **The trap is a term carried in project notes as though a manual used
  it** — verify against the snapshots. **The cert's known cases are in its standards file.**
- **Never write a TRADEMARKED term as content** (§6 rule 10), in a stem, choice, explanation, guide
  fact or `sourceSection`. **Test the practice, never the name**: the behavior a mnemonic packages is
  a set of facts and is fully authorable, and a candidate is tested on the behavior rather than the
  acronym. **Naming an organization or a document in order to cite it stays allowed.** Note this bars
  a term the document *does* use, where rule 4a bars one no document uses — a term can fail either.
  **The cert's live cases are in its standards file**, and that list grows.
  **THE REGISTER ONLY HOLDS WHAT SOMEBODY ALREADY CAUGHT, so an acronym, mnemonic, checklist name or
  course-flavored phrase that is NOT on it is not thereby cleared** — trace it to an owner first, and
  **check its FIRST use in the snapshot, never the instance being copied.** A manual marks a mark
  once and then writes it bare for forty pages, which is how a mark reaches a stem by way of careful
  work. An unlisted term with an owner is a decisions-brief item and a proposed register entry.
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
- **No reader-visible field reproduces its source's expression.** Read each stem, choice,
  explanation, guide `text` and `sourceSection` against the quoted passage sitting beside it in the
  report: facts are free and phrasing is not (§6 rule 1), and a `purchase` or `restricted` document
  supplies neither (§6 rule 5).
- **No reader-visible field carries a term somebody owns.** Barred terms checked against the
  standards register, and **every acronym, mnemonic or named procedure the register does not list
  traced to an owner** — cleared in the report, or raised in the brief. Naming a document to cite it
  stays fine; using a mark as the thing being taught does not (§6 rule 10).
- **Every explanation reads as hand-written.** No stem restated, no *important to note*, no reflexive
  antithesis, no em dashes, no inflated register. **Then read the batch's explanations back to back**
  — if they share one rhythm, they were written to a template rather than to their facts.
- Every `sourceSection` is under 90 characters, points rather than explains, and carries no claim.
- Every scope wider than one state names the documents checked, one per covered state.
- Every id is `<slugShort>-<scope>-<topicNum>-<sitewideNum>`, its segments agree with the fields they
  name, `idKey` equals the trailing number, and no number is reused.
- Every `sisterQuestions` list is symmetric, single-scope, and carries at most one `guide` block
  across the set.
- Every `media.src` names a file that will exist by the time the bank is written, filed under its
  `imageCredit`.
- Every candidate from phase 4 has a verdict **in the ledger**, every `deferred` names its blocker,
  and every `queued` carries its verified scope. No `deferred` blames gate capacity.
- `node scripts/audit-questions.mjs <cert> --proposed <file>` was run against the proposed bank and
  its output is in the report — **including any new NOTE this run introduces.** The flag runs every
  check against a candidate file, so **nothing is spliced into the tracked bank to audit it.**
- `--resolve --proposed <file>` was run for the affected states and pasted into the report, and its
  *not reached* lines were read: **a state missing a fact it should have had is a finding**, and it
  is the one the tokens alone will not show you.

## Report

Write to `blackbox/research/<cert>-questions-<target>-<YYYY-MM-DD>.md` and give a short summary in
the terminal. Suffix rather than overwrite an existing report for the same target and date.

**IT CARRIES NO DESIGN DECISIONS.** Every one is in the brief, settled at gate A or waiting there.
A report that argues for a call has taken gate A's job back.

**Lead with the questions.** The review happens in that section and everything else is context for
it; a reader who stops after it has done the job the gate exists for. Sections, in order:

1. **Header** — cert, target, date, snapshot read, which chunks were worked, and **the brief's
   standing**: settled, or N items still open. **On a `--source` run, say how much of the document
   remains**: chunks `worked` / `working` / `pending`, and how many candidates are still `queued`.
   That is the run's own progress bar, and without it nobody can tell a finished source from an
   abandoned one. **Keep it to a screen.**
2. **The questions** — one block each, carrying: the proposed JSON, **the verbatim source passage**,
   the distractor rebuttals, and the scope decision with the documents checked. **This is the section
   the review actually happens in**, so it is written for reading, not for skimming.
3. **Resolution** — paste `--resolve --proposed` for the affected states. **This is the section that
   says what the scope tokens actually did**, per state and per topic, including what each state does
   not reach and why. It is generated, never written: a hand-written account of who sees what is a
   second owner of the resolver's answer.
4. **Guide impact** — which sections gained facts, which groups are proposed, what still renders
   ungrouped.
5. **Counts** — candidates by verdict; questions by topic and scope; quota movement per state, before
   and after; art required. **Quota movement is reported in both modes and steers only in quota
   mode** — on a `--source` run it is a consequence, not a target.
6. **Not authored, and why** — every `deferred` and `rejected` candidate with its reason, and every
   `queued` one listed separately as the next gate's work. **Never omit this section, even when
   empty**; it is the record that the passage was worked rather than mined for whatever was easiest.
   **Keep `queued` visibly apart from `deferred`** — one is a backlog and the other is a set of
   problems, and a reader who cannot tell them apart cannot tell whether a source is nearly done.
7. **Audit output** — the `--proposed` run, verbatim, with any new NOTE called out.
