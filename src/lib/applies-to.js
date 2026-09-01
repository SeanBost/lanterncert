// Resolves a question's applies_to against a state, via exam.examType and never courseType.
// data-handling.md ▸ Questions §3.

/** Umbrellas reaching any token already held, applied until nothing new is added. */
function withUmbrellas(tokens, exams) {
  for (let added = true; added; ) {
    added = false;
    for (const [token, exam] of Object.entries(exams)) {
      if (tokens.has(token)) continue;
      if (!(exam?.covers ?? []).some((t) => tokens.has(t))) continue;
      tokens.add(token); // adding once makes a covers cycle harmless
      added = true;
    }
  }
  return tokens;
}

/** Every applies_to token matching this state: ALL, its code, its exam, and whatever covers those. */
export function scopeTokens(stateSlug, { states, facts, exams }) {
  const state = states[stateSlug];
  const stateFacts = facts[stateSlug];
  if (!state) throw new Error(`applies-to: no state "${stateSlug}" in states.json`);
  if (!stateFacts) throw new Error(`applies-to: no facts for state "${stateSlug}"`);

  const tokens = new Set(["ALL", state.abbreviation]);

  // Null where the exam is unresearched: no exam-derived content reaches a rider we can't scope.
  const examType = stateFacts.exam?.examType?.value;
  if (examType) tokens.add(examType);

  return withUmbrellas(tokens, exams);
}

/** Scope resolved once for the whole bank; a question carries exactly one token. */
export function questionsForState(questions, stateSlug, ctx) {
  const tokens = scopeTokens(stateSlug, ctx);
  return questions.filter((q) => tokens.has(q.applies_to));
}
