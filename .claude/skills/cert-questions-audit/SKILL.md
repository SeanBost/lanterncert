---
name: cert-questions-audit
description: Verify an existing question bank against its cited sources and report what the mechanical checks cannot see — wrong answers, weak distractors, explanations that do not teach, scope claims a document does not support, and testable material no question covers. Reports only, never writes. Invoked as /cert-questions-audit <cert> [state|--source <key>].
---

# cert-questions-audit

Re-reads authored questions against the documents they cite, and reports. **It writes nothing, ever**
— not a fix, not a date, not a typo.

## Altitude — read this before deciding anything

**A stored question with a stored source is a claim, not a verified fact.** The authoring run had the
passage open and was reasoning forward from it; this run reasons backward from the question and asks
whether the document really says that. Those find different defects, which is why both exist.

- **Report what would make a rider wrong.** A question that is merely inelegant is a NOTE at most. A
  question whose keyed answer is wrong, or whose distractor is defensible, is the finding this run
  exists for.
- **A report full of technically-true objections that change nothing a reader would see is a failed
  run.** It buries the two findings that mattered and trains the next reader to skim.
- **Silence is a valid and valuable result.** *"I re-read all eleven and they hold, here is what I
  checked"* is a better outcome than a manufactured list, and it should be reported with the same
  confidence.

**The bias to fight is agreeableness.** Re-reading content that reads well and cites a real document
makes confirming it feel like the job. It is not: the question is whether the cited passage supports
this exact keyed answer, and that has to be checked against the passage, not against plausibility.

**And correctness is not the only way a question fails.** One that is accurate, cited and sound can
still reproduce its source's sentence, carry somebody's trademark as the thing being taught, or read
as bulk output — three failures that no amount of verification finds, because verification is aimed
somewhere else. Phase 3b is aimed at them, and it is the reason this run reads the whole bank rather
than a batch.

## Invocation

```
/cert-questions-audit <cert>                  every question in the bank
/cert-questions-audit <cert> <state>          only what resolves for that state
/cert-questions-audit <cert> --source <key>   only questions citing that document
/cert-questions-audit <cert> --topic <slug>   only that topic, across states
/cert-questions-audit <cert> --coverage       coverage only: no per-question re-reading
```

`<cert>` takes a slug or its `slugShort`. **`--coverage` is the cheap run** — the script plus the
manual-coverage pass, no question-by-question verification — and it is the right one after an
authoring session. A full run is a periodic exercise, not a per-batch one.

**`--coverage` still runs shipping checks 2 and 3.** Neither needs a passage re-read, both scale with
the bank rather than the batch, and both get worse the longer they wait — a mark that shipped six
weeks ago is a mark that shipped. **Only check 1 waits for a full run**, because setting a question
beside its passage *is* the expensive half.

## Owns / never touches

**Owns:** `blackbox/research/` — its own reports, and nothing else.

**Never touches:** the question bank, the guide scaffold, the facts file, the sources registry,
`blackbox/authoring/`, any UI or route, any standards file, or git. **A finding is reported and
the reviewer decides**, including an obvious typo — the bank's three dates and its git history are a
provenance record, and a silent fix corrupts it.

**It does not add exclusions either.** A gap that should be declared is a report recommendation; the
whole value of `blackbox/authoring/<cert>-exclusions.json` is that a person decided.

**This run reaches no network, ever.** Every source it needs is already a snapshot in
`blackbox/source-snapshots/<cert>/`, and `audit-questions.mjs` makes no requests at all. **A
question whose snapshot looks stale or wrong is a report item for `/cert-facts`**, never a fetch
from here — re-reading a live page is that skill's job and its request budget, not this one's.

## Read first

- **`blackbox/data-handling.md` ▸ *Questions* (§5) and ▸ *Study Guide* (§4c)** — what a correct
  question is. **Not restated here.**
- **`CLAUDE.md` ▸ *The three modes*, ▸ *Conventions*** — the voice rules a stem has to satisfy.
- **`blackbox/data-handling.md` ▸ *Legal and authorship* (§6)** — copyright, fair use and the
  trademark bar. **Not restated here**, and it is what phase 3b is checking against.
- **`blackbox/authoring/<cert>-standards.md`**, plus any source-diff or terminology register it
  names. **Most real scope defects are already enumerated there**, and a finding that contradicts a
  standing ruling is a finding about the ruling, not the question.
- **The most recent report for this target**, which records what was already checked and cleared.

## Phases

Run 0–4 without stopping. Stop at 5.

**0 · Preflight.** Resolve the cert and target. Load the bank, topics, weights, guide scaffold,
registry and exclusions.

**0b · Read `blackbox/authoring/<cert>-standards.md`.** It carries the cert's standing scope
rulings and barred terms, so a question breaking one is a finding the script cannot see.

**1 · Run the script.** `node scripts/audit-questions.mjs <cert> [--state <code>] --resolve`. It owns
every mechanical check — `variantGroup` coverage, the quota table, art per section, near-duplicate
stems, ungrouped facts, unjoined groups, unserved topics, missing `sourceSection`.

**`--resolve` prints what each state actually reads and what it does not reach**, which is where
scope errors become visible: a state missing a fact its own manual teaches is a real hole that every
other check passes clean.

**Its output is an input, not a finding.** Every PROBLEM is worked and explained in your own words;
every NOTE is either dismissed with a reason or promoted. **A report that pastes the script's output
has done none of this run's actual work.**

**2 · Verify questions against their sources.** For each question in scope: read the cited passage in
the snapshot, then answer the four questions in *Verifying a question* below. **A question the
snapshot cannot support is the headline finding of any run that has one.**

**3 · Judge what no check can.** Distractor strength, explanation quality, stem clarity, scope
legality by terminology, and umbrella facts against every covered document. *What the script cannot
see*, below.

**3b · Read the bank as a publisher, not as an examiner.** Phases 2 and 3 ask whether a question is
**right**. This one asks whether it is **ours to ship**, which is a different failure and passes
every other check clean: content can be perfectly accurate, perfectly cited, and still be a legal
problem or a credibility problem. Three passes, each over every reader-visible field — stem, choices,
explanation, guide `label` and `text`, `sourceSection`, and image `alt`. *The three shipping checks*
below is where they live.

**4 · Coverage.** Walk each source document's own contents and mark which sections have produced no
question. **The document's table of contents is the checklist** — this is what answers *"did any core
testable material get missed?"*, and it is the half of the job the script cannot do at all.

**5 · Report.** Write it, summarize in the terminal, stop.

## Verifying a question

Four questions per item, in this order. **Record the passage quote for every one you verify** — a
question you have confirmed without quoting is a question you have re-read, not verified.

1. **Does the cited passage state the keyed answer?** Not *"is the keyed answer true"* — whether
   *this document* says it. A true answer cited to a document that does not carry it is a broken
   citation, and it is the most common real defect.
2. **Does the passage rule out every distractor?** A distractor the source leaves defensible makes
   the question wrong, regardless of what the key says.
3. **Does `sourceSection` still locate the passage?** Documents are reissued and headings move.
4. **Does the explanation still assert exactly what the passage supports** — no drift, no widening,
   nothing added while it was being polished?

**`lastVerified` is what this run would move**, so a question you did not actually re-read against
its snapshot must not be reported as verified. Say what you read.

## The three shipping checks

**The standing law is `data-handling.md` ▸ *Legal and authorship* (§6). Not restated here.** These
are the three questions to ask of the bank at phase 3b, and each one is asked in a mode the other
phases never enter.

**All three are PROBLEM findings when they hit**, however small the wording. Their cost is not a
rider getting an item wrong — it is a takedown, a demand letter, or a reader deciding the whole site
was generated. **None of them is a taste call**, so none of them gets softened to a NOTE.

### 1 · Does it steal?

Set each question beside the passage it cites and read the two together. **Facts are free and
expression is not** (§6 rule 1), so a question can name the right fact, cite the right document, and
still reproduce that document's sentence.

- **The tell is a clause that could not have been written without the document open** — its
  structure, its distinctive verb, its ordering of a list, its unusual qualifier. A shared technical
  noun is not a finding; a shared shape is.
- **Check the choices, not just the explanation.** A distractor lifted from a bulleted list carries
  that list's phrasing straight through, and it is the field nobody re-reads.
- **A `purchase` or `restricted` source is stricter** (§6 rule 5): nothing from it may be reproduced
  at all, so any traceable phrasing is a finding rather than a judgment.
- **Class A art reproduces an artifact on purpose**, which is the point of the class; what it may not
  do is reproduce a **publisher's drawing** of that artifact. Check the recipe, not the image.
- **Then check the reverse direction on `sourceSection`** — a locator quoting a marked or copyrighted
  heading verbatim is reproduction on a rendered page, however short.

### 2 · Does it read as machine-written?

**Judge it as a reader who never saw how it was made**, because that is the only reader it gets. A
bank that reads as generated is not a style problem: per-question citation is the entire wedge, and
content that pattern-matches to bulk output undermines the claim it exists to make.

**THIS CHECK IS PER-BANK, NOT PER-QUESTION, AND THAT IS WHY IT LIVES HERE.** An authoring run sees
one question at a time and cannot see the tell at all; this run is the only one holding forty
explanations at once. **Sameness is the finding.** Read every explanation in a topic back to back:
identical sentence length, identical rhythm, every one opening on the same construction, every one
closing on a restated consequence — that is the signature, and no single item shows it.

Per item, the tells worth naming:

- **The explanation restates the stem before answering it.** A human writing a fact writes the fact.
- **Antithesis as a reflex** — *"it isn't X, it's Y"*, *"not because A, but because B"* — used where a
  plain assertion carries the same content.
- **Tricolons everywhere.** Three parallel clauses is a fine sentence and a terrible habit; count how
  many the topic contains.
- **Hedge-then-assert padding** — *it is important to note*, *keep in mind*, *remember that*,
  *generally speaking* — all of which say nothing and all of which appear when a sentence is being
  produced rather than written.
- **Inflated register**: *crucial*, *vital*, *ensure*, *utilize*, *leverage*, *delve*, *robust*,
  stacked adverbs. The house voice is plain.
- **Em dashes and en dashes**, which are banned in rendered copy anyway and are a reliable tell on
  top of that. The house mark is a hyphen.

**The fix is never a synonym pass.** A flagged explanation is rewritten from the fact, and the report
says so rather than proposing replacement wording — rewriting is the authoring run's job and this
run writes nothing.

### 3 · Whose mark is this?

§6 rule 10 bars a trademarked term as content anywhere a reader sees it, and the cert's live cases
are in its standards file. **The register catches only what is already on it, so this check has two
halves and the second is the one that matters.**

- **Against the register:** every barred term, in every reader-visible field, including
  `sourceSection` and `alt`. Mechanical, and the script does not do it.
- **For the register:** every acronym, mnemonic, named procedure, checklist name and
  course-flavored phrase in the bank that is **not** on the register gets traced to an owner before
  it is cleared. A term with no owner is fine; a term with one is a new case, and the report
  nominates it.
- **CHECK THE FIRST USE IN THE SNAPSHOT, NEVER THE USE THAT WAS COPIED.** A manual marks a mark
  once, at first use, and then writes it bare for forty pages. Reading the bare instance is exactly
  how a mark gets carried into a stem by someone doing careful work, and it is a near-miss this
  project has actually had.
- **Test the practice, never the name.** A question resting on the *behavior* a mnemonic packages is
  sound and stays; only the name is the defect, so the finding is usually a two-word deletion.
- **Naming an organization, course or document in order to cite it is not a finding** (§6 rule 7) —
  the line is content versus citation.
- **Logos are never ours** (§6 rule 7), which reaches art: an agency wordmark or seal inside a Class
  A image is a finding even where the sign it sits on is faithfully reproduced.

## What the script cannot see

- **Scope by terminology.** §5 rule 4a scopes a named procedure or mnemonic exactly like a number,
  and no regex derives that. **A term one covered manual does not use invalidates the umbrella**,
  however universal the advice underneath it. Check every wide-scoped question against the cert's
  terminology register.
- **Umbrella facts against every covered document.** For each wide-scoped question, confirm the
  asserted fact is locatable in **every** state manual that umbrella reaches — run
  `audit-questions.mjs <cert> --resolve` to see exactly which states that is.
  **This is deliberately a re-runnable check rather than a stored record** — pointing it at a new
  state's manual is exactly how you find which umbrella questions can widen when state five arrives,
  and a note written today would have gone stale instead.
- **Whether a distractor is defensible.** The script sees four strings; only a reader sees that one
  of them is arguably correct.
- **Whether an explanation teaches.** Read it with the question hidden. It is also the Study Guide
  fact, so an explanation that only makes sense as an answer is a defect in two places.
- **Whether a `guide.kind` fits its fact.** A value forced into `rule`, or a procedure flattened out
  of `steps`, is what makes a section read as a wall of sentences.
- **Whether the quota was met by breadth or by padding.** The script counts; it cannot see that six
  of a topic's questions are one fact in six costumes. Undeclared re-angles are the tell.
- **Whether a question is worth asking at all.** Trivia that no exam would test still passes every
  mechanical check.
- **Whether the copy is ours to ship.** Reproduced expression, an owned mark used as content, and
  prose that reads as generated are all invisible to a checker that only sees strings, fields and
  counts. *The three shipping checks*, above.

## Severity

Findings carry exactly one, and the split follows `validate.mjs`'s format.

- **PROBLEM** — a rider could be wrong. A keyed answer the source does not support, a defensible
  distractor, a broken citation, a scope claim a covered document contradicts, an undeclared
  coverage gap. **Exits non-zero when the script raises it; always leads the report when it does
  not.** **Every phase 3b finding is a PROBLEM too**, on a different ground: reproduced expression,
  a mark used as content, or copy that reads as generated is a risk to the site rather than to one
  rider, and it does not get graded by how few words it is.
- **NOTE** — everything else. Quota shortfalls, art gaps, ungrouped facts, wording, a `sourceSection`
  that could be sharper. Real, and never urgent.
- **ACCEPTED** — a known, deliberate deviation, declared at the top of the report so it prints every
  run without crying wolf. A declared exclusion is the model: it keeps printing, and it never counts
  as a finding.

**Never promote a NOTE to make a run look productive, and never demote a PROBLEM because it is
inconvenient to fix.**

## Making calls

**Decide:** whether a passage supports a keyed answer · whether a distractor is defensible · whether
an explanation stands alone · whether a script NOTE is worth promoting · whether a coverage gap is a
real hole or immaterial · the severity of anything above.

**Escalate:** a question whose answer is wrong (never quietly rewrite it) · two held documents
disagreeing · a source that appears to have changed since its snapshot, which is `/cert-facts`'s job
and not this run's · a gap that ought to become a declared exclusion · **a term that looks owned but
is not on the register**, which is a proposed addition to the cert's standards file and never a
call made inside a report · **anything phase 3b turns up that the rules do not already answer**,
since a fair-use judgment made once per question is exactly what §6 rule 10 exists to avoid.

## Report

Write to `blackbox/research/<cert>-question-audit-<target>-<YYYY-MM-DD>.md`, summarize in the
terminal, suffix rather than overwrite.

Sections, in order:

1. **Header** — cert, target, date, scope of the run, and **how many questions were actually re-read
   against their snapshots** versus how many were in scope. A partial pass says so plainly.
2. **ACCEPTED** — standing deviations, so the rest of the report is only new information.
3. **PROBLEM findings** — each with the question id, the cited passage, and what it actually
   supports. Most severe first.
4. **NOTE findings** — grouped by check, not by question, so a pattern across ten questions reads as
   one issue rather than ten.
5. **Shipping** — the three checks at phase 3b, each reported even when it found nothing, because a
   silent legal check is indistinguishable from a skipped one. Carry: every flagged field with the
   source phrasing set beside it; every term traced to an owner, including the ones cleared and who
   they were traced to; and **the per-bank read on voice**, which is a paragraph about the topic
   rather than a list of items. **Terms nominated for the register go here, framed as a proposal.**
6. **Coverage** — the quota table, plus per-document sections with no question behind them. This is
   the section that drives the next authoring run, so name the chunks by their own headings.
7. **Verified clean** — what was checked and holds. **Never omit it.** It is what makes the findings
   above mean something, and it is the record that stops the next run redoing settled work.
