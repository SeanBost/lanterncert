---
name: wrap
description: Close a working session - snapshot the private docs, bring every doc the session affected up to date, and add a session-log entry sized to what actually happened. Writes directly, with no review gate. Invoked as /wrap.
---

# wrap

Closes a session while its context is still loaded. Docs are kept current during the work, so this is
the last sweep before walking away, not the moment the project's memory gets written.

1. **Snapshot** with `node blackbox/project/tools/snapshot-docs.mjs`, before any edit. It is the only undo for the
   gitignored docs.
2. **Make everything current.** Delete finished items from `blackbox/project/todo.md` and add newly owed ones.
   Correct any doc line the session made untrue, and rewrite the spine's current state, which stays a
   few lines. Rewrite what is out of date rather than adding beside it. A rule is written only when the session decided one;
   lessons don't become rules.
3. **Check the comments** in every code file the session edited: one line, saying what the code does.
4. **Write the entry** at the top of `blackbox/project/sessions.md`, as `## <n> · <title> — <date>`.
   - **Size it to the session.** A routine session is one to three lines; a big one gets what it
     needs. No section is required.
   - **What changed and what was decided**, a rejected option and its reason in a clause. Leave out
     anything git, the doc history or `todo.md` already holds.
   - **`📌 **Case study:**` and one sentence**, only when something happened worth telling: a reversal,
     a correction, a call that went against instinct. Most sessions have none.
   - **A next-session line** only when work stopped mid-task and `todo.md` doesn't say so.
5. **If tracked files changed**, run `node blackbox/project/tools/check-attribution.mjs` and fix what it reports.
6. **Report in a few lines.** Nothing waits for approval; corrections come after.

Nothing is added to the session log outside a wrap.
