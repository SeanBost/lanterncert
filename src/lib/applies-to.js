// Resolves a question's applies_to against a state. Cert-agnostic: every input is passed in, so
// this works unchanged for CDL or ham radio.
//
// A question is scoped by what a rider is TESTED on, never what they were taught — the token
// resolves against exam.examType, and courseType is descriptive only.
// CLAUDE.md ▸ Locked decisions; data-handling.md ▸ Questions §3.

/**
 * Exam tokens a state's own exam satisfies, walking `conformsTo` upward.
 *
 * Content inherits DOWNWARD only. MSF's BRC conforms to the 2011 Model National Standards, so a
 * Florida rider sitting the BRC is covered by anything true of the standard — but a Texan, whose
 * school may have taught a different conformant curriculum, is NOT covered by BRC specifics.
 * Walking up from the state's own exam is what encodes that asymmetry.
 */
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

  // Null where a state's exam is unresearched — it then matches only ALL and its own code, which is
  // the honest fallback: no exam-derived content reaches a rider whose exam we can't name.
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
