// Resolves how much of a state's study material each topic is owed.
// data-handling.md ▸ Questions §3b-i.

/** Baseline merged with a state's sparse overrides; absent means inherit, 0 means withheld. */
export function weightsForState(stateSlug, { baseline, states = {} }) {
  const overrides = states[stateSlug] ?? {};
  return Object.fromEntries(
    Object.entries(baseline).map(([topic, weight]) => [topic, overrides[topic]?.weight ?? weight]),
  );
}

/** Topics a rider in this state may be served AT ALL — a zero weight withholds a topic everywhere. */
export function topicsForState(stateSlug, weights) {
  return Object.entries(weightsForState(stateSlug, weights))
    .filter(([, weight]) => weight > 0)
    .map(([topic]) => topic);
}

/** Weights as fractions of the state's own total, so an override rebalances the rest on its own. */
export function topicShares(stateSlug, weights) {
  const merged = weightsForState(stateSlug, weights);
  const total = Object.values(merged).reduce((sum, w) => sum + w, 0);
  if (!total) throw new Error(`topic-weights: every topic is zero for "${stateSlug}"`);
  return Object.fromEntries(Object.entries(merged).map(([topic, w]) => [topic, w / total]));
}

/** Questions owed per topic for a test of this length, by largest remainder so the total is exact. */
export function topicQuota(stateSlug, weights, questionCount) {
  const shares = topicShares(stateSlug, weights);
  const exact = Object.entries(shares).map(([topic, share]) => [topic, share * questionCount]);
  const quota = Object.fromEntries(exact.map(([topic, n]) => [topic, Math.floor(n)]));
  let remaining = questionCount - Object.values(quota).reduce((sum, n) => sum + n, 0);
  const byRemainder = exact
    .filter(([topic]) => shares[topic] > 0)
    .sort((a, b) => (b[1] % 1) - (a[1] % 1));
  for (let i = 0; remaining > 0 && byRemainder.length; i++, remaining--) {
    quota[byRemainder[i % byRemainder.length][0]] += 1;
  }
  return quota;
}
