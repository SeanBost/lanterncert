// Which questions a rider has missed, read off stored answers. Pure, shared by the tool and /progress.

/** The idKeys whose most recent answer was wrong. */
export function missedKeys(answers) {
  const missed = new Set();
  for (const [k, history] of Object.entries(answers ?? {})) {
    const last = history.reduce((a, b) => (b[0] >= a[0] ? b : a), history[0]);
    if (last && last[1] === 0) missed.add(k);
  }
  return missed;
}
