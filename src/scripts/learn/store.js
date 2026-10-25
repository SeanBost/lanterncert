// Progress, test history and preferences under one versioned localStorage key. The one module that
// touches localStorage: /progress and the header CTA read through it too.

const KEY = "lanterncert";
export const VERSION = 1;
const ANSWERS_KEPT = 5;
const TESTS_KEPT = 50;

const fresh = (tracking = true) => ({ version: VERSION, tracking, prefs: {}, certs: {} });

/** Each step lifts a blob one version: index n takes version n + 1 to n + 2. */
const MIGRATIONS = [];

/** This session's copy, and the truth whenever nothing may be written. */
let blob = null;
let persistent = true;
let readOnly = false;
const listeners = new Set();

/** True for a blob this code can read at all. */
function wellFormed(data) {
  return (
    data !== null &&
    typeof data === "object" &&
    Number.isInteger(data.version) &&
    data.version >= 1 &&
    typeof data.tracking === "boolean"
  );
}

/** A blob brought up to VERSION; one newer than this code is shown and never written over. */
function migrate(data) {
  if (data.version > VERSION) {
    readOnly = true;
    return data;
  }
  let next = data;
  while (next.version < VERSION) next = MIGRATIONS[next.version - 1](next);
  next.prefs ??= {};
  next.certs ??= {};
  return next;
}

/** Parks an unreadable blob under its own key rather than losing it. */
function setAside(raw) {
  try {
    localStorage.setItem(`${KEY}:corrupt-${Date.now()}`, raw);
  } catch {
    /* nowhere left to put it */
  }
}

function load() {
  let raw;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    persistent = false;
    return blob ?? fresh();
  }
  if (raw === null) return fresh();
  try {
    const data = JSON.parse(raw);
    if (wellFormed(data)) return migrate(data);
  } catch {
    /* falls through */
  }
  setAside(raw);
  return fresh();
}

/** Writes the blob, or only the switch when tracking is off. */
function save(next) {
  blob = next;
  if (readOnly || !persistent) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(next.tracking ? next : fresh(false)));
  } catch {
    persistent = false;
  }
}

function emit() {
  for (const fn of listeners) fn(blob);
}

/** Applies a change to the latest copy and saves it; a change returning false saves nothing. */
function write(change) {
  const current = read();
  // From storage when it is live, so two tabs never clobber each other; from memory otherwise.
  const next = persistent && !readOnly && current.tracking ? load() : current;
  if (change(next) === false) return;
  save(next);
  emit();
}

/** One state's record, created on first write. */
function stateOf(data, cert, state) {
  const certs = (data.certs[cert] ??= {});
  return (certs[state] ??= { answers: {}, tests: [], inProgress: null });
}

/** The study tool last opened, as a link, or null when none has been or tracking is off. */
export function lastToolHref() {
  const { cert, state, mode } = read().prefs ?? {};
  if (!cert || !state) return null;
  return `/${cert}/${state}/learn${mode && mode !== "guide" ? `?mode=${mode}` : ""}`;
}

/** The current blob. Treat it as read-only. */
export function read() {
  blob ??= load();
  return blob;
}

/** Whether anything reaches storage, whether the blob is newer than this code, and the switch. */
export function status() {
  const data = read();
  return { persistent, readOnly, tracking: data.tracking };
}

/** Calls fn with the blob after every change, in this tab or another. Returns the unsubscribe. */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** One state's record, or an empty one. Treat it as read-only. */
export function stateRecord(cert, state) {
  return read().certs?.[cert]?.[state] ?? { answers: {}, tests: [], inProgress: null };
}

export function recordAnswer(cert, state, k, right, mode) {
  write((data) => {
    if (!data.tracking) return false;
    const answers = stateOf(data, cert, state).answers;
    answers[k] = [...(answers[k] ?? []), [Date.now(), right ? 1 : 0, mode]].slice(-ANSWERS_KEPT);
  });
}

export function setPrefs(patch) {
  write((data) => {
    if (!data.tracking) return false;
    data.prefs = { ...data.prefs, ...patch };
  });
}

/** Opens the state's one in-progress test. */
export function startTest(cert, state, attempt) {
  write((data) => {
    stateOf(data, cert, state).inProgress = attempt;
  });
}

export function updateTest(cert, state, patch) {
  write((data) => {
    const record = stateOf(data, cert, state);
    if (!record.inProgress) return false;
    record.inProgress = { ...record.inProgress, ...patch };
  });
}

/** Closes the in-progress test, filing it in history and its answers as mode "t". */
export function finishTest(cert, state, result) {
  write((data) => {
    const record = stateOf(data, cert, state);
    record.inProgress = null;
    if (!data.tracking) return;
    record.tests = [result, ...record.tests].slice(0, TESTS_KEPT);
    for (const item of result.items) {
      if (item.chose === null) continue;
      const history = record.answers[item.k] ?? [];
      record.answers[item.k] = [...history, [result.endedAt, item.right ? 1 : 0, "t"]].slice(-ANSWERS_KEPT);
    }
  });
}

/** Ends the in-progress test unscored. */
export function dropTest(cert, state) {
  write((data) => {
    const record = data.certs?.[cert]?.[state];
    if (!record?.inProgress) return false;
    record.inProgress = null;
  });
}

/** The whole blob as a JSON string, for a download. */
export function exportBlob() {
  return JSON.stringify(read(), null, 2);
}

/** Erases every answer, result and preference, leaving the tracking switch as it was. */
export function erase() {
  write((data) => {
    const { tracking } = data;
    for (const key of Object.keys(data)) delete data[key];
    Object.assign(data, fresh(tracking));
  });
}

/** Turning tracking off erases everything; turning it on starts empty. */
export function setTracking(on) {
  write((data) => {
    for (const key of Object.keys(data)) delete data[key];
    Object.assign(data, fresh(on));
  });
}

window.addEventListener("storage", (event) => {
  if (event.key !== KEY && event.key !== null) return;
  blob = load();
  emit();
});
