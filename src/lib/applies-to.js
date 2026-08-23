// Resolves a question's applies_to against a state, via exam.examType and never courseType.
// CLAUDE.md ▸ Locked decisions; data-handling.md ▸ Questions §3.

/** Exam tokens a state's exam satisfies, walking `conformsTo` upward - content inherits downward. */
function satisfiedBy(examType, exams) {
  const seen = new Set();
  const queue = [examType];
  while (queue.length) {
    const token = queue.shift();
    if (!token || seen.has(token)) continue; // the seen check also makes a bad cycle harmless
    seen.add(token);
    queue.push(...(exams[token]?.conformsTo ?? []));
  }
  return seen;
}

/** Every applies_to token that matches this state: ALL, its code, its exam, and that exam's standards. */
export function scopeTokens(stateSlug, { states, facts, exams }) {
  const state = states[stateSlug];
  const stateFacts = facts[stateSlug];
  if (!state) throw new Error(`applies-to: no state "${stateSlug}" in states.json`);
  if (!stateFacts) throw new Error(`applies-to: no facts for state "${stateSlug}"`);

  const tokens = new Set(["ALL", state.abbreviation]);

  // Null where the exam is unresearched: no exam-derived content reaches a rider we can't scope.
  const examType = stateFacts.exam?.examType?.value;
  if (examType) for (const t of satisfiedBy(examType, exams)) tokens.add(t);

  return tokens;
}

/** True when any of a question's tokens matches the state. Plain union; overlap is allowed. */
export function appliesTo(question, stateSlug, ctx) {
  const tokens = scopeTokens(stateSlug, ctx);
  return question.applies_to.some((t) => tokens.has(t));
}

export function questionsForState(questions, stateSlug, ctx) {
  const tokens = scopeTokens(stateSlug, ctx);
  return questions.filter((q) => q.applies_to.some((t) => tokens.has(t)));
}
