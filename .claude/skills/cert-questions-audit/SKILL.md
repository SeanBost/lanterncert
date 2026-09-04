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

## Owns / never touches

**Owns:** `blackbox/research/` — its own reports, and nothing else.

**Never touches:** the question bank, the guide scaffold, the facts file, the sources registry,
`blackbox/authoring/`, any UI or route, any standards file, or git. **A finding is reported and
Sean decides**, including an obvious typo — the bank's three dates and its git history are a
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
- **The MOM diff and the terminology register** for this cert — §3 and §4 of
  `blackbox/research/motorcycle-endorsement-mom-diff-2026-08-31.md`. Most real scope defects are
  already enumerated there.
- **The most recent report for this target**, which records what was already checked and cleared.

## Phases

Run 0–4 without stopping. Stop at 5.

**0 · Preflight.** Resolve the cert and target. Load the bank, topics, weights, guide scaffold,
registry and exclusions.

**1 · Run the script.** `node scripts/audit-questions.mjs <cert> [--state <code>]`. It owns every
mechanical check — `variantGroup` coverage, the quota table, art per section, near-duplicate stems,
ungrouped facts, unjoined groups, unserved topics, missing `sourceSection`.

**Its output is an input, not a finding.** Every PROBLEM is worked and explained in your own words;
every NOTE is either dismissed with a reason or promoted. **A report that pastes the script's output
has done none of this run's actual work.**

**2 · Verify questions against their sources.** For each question in scope: read the cited passage in
the snapshot, then answer the four questions in *Verifying a question* below. **A question the
snapshot cannot support is the headline finding of any run that has one.**

**3 · Judge what no check can.** Distractor strength, explanation quality, stem clarity, scope
legality by terminology, and umbrella facts against every covered document. *What the script cannot
see*, below.

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

## What the script cannot see

- **Scope by terminology.** §5 rule 4a scopes a named procedure or mnemonic exactly like a number,
  and no regex derives that. **SEE** is valid for GA, CA and TX and invalid for FL; **T-CLOCS** is FL
  and TX only; **pennant** is MUTCD and not Georgia. Check any wide-scoped question against the
  terminology register.
- **Umbrella facts against every covered document.** For each `momstandard` or otherwise wide-scoped
  question, confirm the asserted fact is locatable in **every** state manual that umbrella reaches.
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

## Severity

Findings carry exactly one, and the split follows `validate.mjs`'s format.

- **PROBLEM** — a rider could be wrong. A keyed answer the source does not support, a defensible
  distractor, a broken citation, a scope claim a covered document contradicts, an undeclared
  coverage gap. **Exits non-zero when the script raises it; always leads the report when it does
  not.**
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
and not this run's · a gap that ought to become a declared exclusion.

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
5. **Coverage** — the quota table, plus per-document sections with no question behind them. This is
   the section that drives the next authoring run, so name the chunks by their own headings.
6. **Verified clean** — what was checked and holds. **Never omit it.** It is what makes the findings
   above mean something, and it is the record that stops the next run redoing settled work.
