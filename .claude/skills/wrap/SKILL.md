---
name: wrap
description: Close a working session — freeze a snapshot, write the session-log entry with its case-study block, reconcile the to-do list by deleting what is done, audit the comments touched, run the attribution and documentation checks, and fold anything durable into the operative docs. Stops at one review gate and writes nothing before approval. Invoked as /wrap.
---

# wrap

Closes a session. **Every step below runs; none is optional and none is skipped for being quiet.**

## Altitude — read this before deciding anything

**Wrapping is the moment the project's memory is written, and it is the step most often done from
memory.** That is the whole reason this is a skill rather than a checklist in a document read a
hundred thousand tokens earlier.

- **The instruction to wrap IS the instruction to do all of it.** Don't ask which parts to run.
- **Deleting is the work.** A to-do item that is finished comes out; ticking is not available and
  neither is leaving it with a note. If a call must never be re-proposed it is a decision, and it
  goes to the declined register with an ID rather than staying as a tombstone.
- **A weak case-study entry is deleted in one line; an unrecorded one is gone forever.** Be generous,
  and favor reversals, corrections, rejected alternatives and counterintuitive calls — those are
  exactly what a tidied narrative loses, and they are the entries worth having a year from now.
- **Report what actually happened, including what broke.** A wrap that reads like everything went
  smoothly is a wrap that lost the interesting half.

## Phases

Run 1-5 uninterrupted. Stop at the gate. Write only what is approved.

### 1 · Freeze

```
node blackbox/snapshot-docs.mjs
```

**Before any edit.** These files are gitignored, so the snapshot is their only undo. A folder is
never refreshed in place; the script suffixes instead.

### 2 · Gather

Read the session's own diff and history — what changed, what was decided, what was abandoned. Then:

```
node blackbox/status.mjs
node blackbox/doc-health.mjs
node blackbox/check-doc-overlap.mjs
node blackbox/check-attribution.mjs
```

**Read the findings; do not fix them yet.** They are inputs to the gate. A PROBLEM that appeared this
session belongs in the entry as much as the work that caused it.

### 3 · Audit the comments

**Every comment in every file touched this session**, against the spine's *Conventions*: still
accurate, still one line, still saying what the code does rather than why. A session of edits leaves
stale and stacked comments behind as a matter of course, and a comment describing code that has since
moved is worse than no comment.

### 4 · Reconcile the to-do list

For each item the session closed:

- **Grep every core doc for the item's distinctive selector, filename or term first.** Deletion is
  the one moment you know exactly what to grep for, and roughly a hundred pointers reach that file.
- **Delete the item.** Part-done keeps only the part that is not, rewritten as an open item.
- **A declined or accepted-as-built call moves to the declined register** with a new `D-NN` and the
  load-bearing clause — not a summary of it.
- **An item whose opening premise has gone stale is rewritten, not left standing.**

Then check the bucket is still right, and regenerate the contents table if any section moved.

### 5 · Draft the entry

A `sessions.md` entry at the top, newest first, in the file's established shape: **Shipped** ·
**Decided** · **Learned**, closing with a `📌 Case study` block.

**Nothing is appended to the session log outside a wrap.**

### GATE — propose, do not write

Present, in one message:

1. **The session-log entry**, in full.
2. **The to-do reconciliation** — every deletion with the pointer check that cleared it, every
   rewrite, every new `D-NN`.
3. **Durable findings to fold into the operative docs** — each as a one-line rule naming the file
   that should own it. **Propose; never write a standards change directly.**
4. **What the four checks reported**, and which findings this session created.

Wait for approval. **On approval, write everything in one pass and re-run the four checks** — the
wrap's own edits can introduce a duplication or a dangling pointer, and that is exactly when nobody
is looking.

## Boundaries

- **Owns:** `sessions.md`, `todo.md`, `decisions.md`, and the snapshot.
- **Proposes but never writes on its own:** any change to `data-handling.md`, the spine, or a cert
  standards file.
- **Never touches:** the question bank, the facts files, the sources registry, or anything in `src/`.
