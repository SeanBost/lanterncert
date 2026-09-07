---
name: doc-audit
description: Run the documentation checks, read what they report, and propose fixes at a review gate — size against the spine budget, pointers that no longer resolve, lists that have drifted from the directory they mirror, passages with two owners, and attribution or spelling violations. Proposes only, never writes before approval. Invoked as /doc-audit.
---

# doc-audit

The periodic pass over the governing layer. **`/wrap` runs the same checks and only reports them;
this one works the findings.**

## Altitude — read this before deciding anything

**The scripts own what is mechanical; this run owns what a script cannot judge.** A dangling pointer
is a fact. Whether the fix is to repair the pointer, move the passage, or delete the rule is not.

- **A finding is not automatically a defect.** A shared passage may be a legitimate name, guard rule
  or pointer; a rule with no mechanism may be fine as prose. **Ask what the failure mode is before
  proposing a fix**, and say so when the answer is "none."
- **Prefer deleting a rule to mechanizing one nobody has ever broken.** The census exists to find
  rules worth enforcing, not to enforce all of them.
- **A run reporting "these hold, here is what I checked" is a good run.** The bias to fight is
  manufacturing findings to look productive.
- **Never delete a check to silence it.** A deliberate deviation goes in that script's `ACCEPTED`
  block, where it stays visible and stays quiet.

## Phases

### 1 · Run everything

```
node blackbox/doc-health.mjs
node blackbox/check-doc-overlap.mjs
node blackbox/check-attribution.mjs
node blackbox/extract-case-study.mjs --check
node blackbox/status.mjs
```

All five reach no network. Run them before reading anything, so the findings frame the reading rather
than the other way round.

### 2 · Classify each finding

For every PROBLEM and every NOTE, decide which it is and say which:

- **A real defect** — a pointer that should resolve, a passage with two owners, a violation.
- **A missing declaration** — real, but the right fix is an `ACCEPTED` entry naming why.
- **A check that is wrong** — the script's rule does not match the actual standard. **Fix the script,
  and say what the standard actually is.**

### 3 · Read what the scripts cannot

- **Is the spine still the spine?** Anything in it that only matters while touching one file belongs
  in a leaf, and the router should name that leaf.
- **Does every rule still have an owner that exists?** The IDs survive a reorganization; the owner
  column does not, and it goes stale silently.
- **Has a leaf grown a second concern?** That is how the spine grew in the first place.
- **Is any list in a doc mirroring a directory?** Describe the shape and name the directory instead.

### GATE — propose, do not write

Present the findings in one message, most consequential first, each with: what it is, which of the
three classes above, the proposed fix, and the file that would change. **Include what you checked and
found clean** — that is the difference between a report and a list of complaints.

Wait for approval. **On approval, apply the fixes and re-run all five** — the fixes themselves are
edits to the governed files and can introduce exactly what was just removed.

## Boundaries

- **Owns:** the checking scripts in `blackbox/`, and their `ACCEPTED` blocks.
- **Proposes but never writes on its own:** any rule change, in any operative doc.
- **Never touches:** anything in `src/`, the question bank, the facts files, or the sources registry.
