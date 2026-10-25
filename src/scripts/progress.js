// /progress, filled from the store: next steps, recent activity, missed questions and
// the data controls. The static HTML is the zero state the script fills.
import * as store from "./learn/store.js";
import { confirm } from "./learn/dialog.js";
import { missedKeys } from "../lib/missed.js";
import { scoreTest } from "../lib/seeded.js";

const MODE_NAMES = { guide: "Study Guide", cards: "Practice Cards", test: "Mock Test" };
/** A gap longer than this starts a new Practice Cards session. */
const SESSION_GAP_MS = 30 * 60 * 1000;
const ACTIVITY_SHOWN = 20;
const MISSED_TOPICS_SHOWN = 3;

const slot = (name) => document.querySelector(`[data-slot="${name}"]`);
const el = (tag, className, text) => Object.assign(document.createElement(tag), className ? { className } : {}, text == null ? {} : { textContent: text });
const shortDate = (ms) => new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export function initProgress() {
  const names = JSON.parse(document.getElementById("progress-data").textContent);
  const pools = new Map();
  const poolFor = (cert, state) => {
    const key = `${cert}/${state}`;
    if (!pools.has(key)) {
      pools.set(
        key,
        fetch(`/${cert}/${state}/learn/pool.json`)
          .then((r) => (r.ok ? r.json() : null))
          .then((pool) => pool && { ...pool, byKey: new Map(pool.questions.map((q) => [q.k, q])) })
          .catch(() => null),
      );
    }
    return pools.get(key);
  };
  const stateName = (state) => names.states[state] ?? state.toUpperCase();
  const learnUrl = (cert, state, query = "") => `/${cert}/${state}/learn${query}`;

  /** Every cert and state this browser holds answers or tests for. */
  const used = (blob) =>
    Object.entries(blob.certs ?? {}).flatMap(([cert, byState]) =>
      Object.entries(byState)
        .filter(([, r]) => Object.keys(r.answers ?? {}).length || (r.tests ?? []).length)
        .map(([state, record]) => ({ cert, state, record })),
    );

  // ---- Next steps and activity ---------------------------------------------------------------------

  const renderNext = (blob, any) => {
    const { cert, state, mode } = blob.prefs ?? {};
    const button = slot("next-button");
    const text = slot("next-text");
    slot("zero-caption").hidden = any;
    if (!cert || !state || !mode) return;
    text.textContent = "Pick up where you left off.";
    button.textContent = `Continue with ${stateName(state)} ${MODE_NAMES[mode] ?? "Study Guide"}`;
    button.setAttribute("href", learnUrl(cert, state, mode === "guide" ? "" : `?mode=${mode}`));
  };

  /** Mock Tests, and runs of card answers with no gap over half an hour, newest first. */
  const activity = (states) => {
    const rows = [];
    for (const { state, record } of states) {
      for (const test of record.tests ?? []) {
        const s = scoreTest(test.correct, test.count, test.pass);
        rows.push({
          at: test.endedAt,
          text: `Mock Test · ${stateName(state)} · ${test.correct} of ${test.count} (${s.percent}%) · ${s.passed ? "Passed" : "Not a pass"}`,
        });
      }
      const cards = Object.values(record.answers ?? {})
        .flat()
        .filter((a) => a[2] === "c")
        .sort((a, b) => a[0] - b[0]);
      let run = [];
      const close = () => {
        if (!run.length) return;
        const right = run.filter((a) => a[1] === 1).length;
        rows.push({
          at: run.at(-1)[0],
          text: `Practice Cards · ${stateName(state)} · ${run.length} answered · ${Math.round((right * 100) / run.length)}% right`,
        });
        run = [];
      };
      for (const answer of cards) {
        if (run.length && answer[0] - run.at(-1)[0] > SESSION_GAP_MS) close();
        run.push(answer);
      }
      close();
    }
    return rows.sort((a, b) => b.at - a.at).slice(0, ACTIVITY_SHOWN);
  };

  const renderActivity = (states) => {
    const rows = activity(states);
    const list = slot("activity");
    slot("activity-empty").hidden = rows.length > 0;
    list.hidden = rows.length === 0;
    list.replaceChildren(
      ...rows.map((row) => {
        const li = el("li", "activity-list__row");
        li.append(el("span", "activity-list__date", shortDate(row.at)), el("span", null, row.text));
        return li;
      }),
    );
  };

  // ---- Missed ------------------------------------------------------------------------------------

  /** Waits on each pool; a newer render landing first wins. */
  const renderMissed = async (states, blob, ticket) => {
    const list = slot("missed");
    const rows = [];
    for (const { cert, state, record } of blob.tracking ? states : []) {
      const pool = await poolFor(cert, state);
      if (!pool) continue;
      const missed = [...missedKeys(record.answers)].filter((k) => pool.byKey.has(k));
      if (!missed.length) continue;
      const byTopic = new Map();
      for (const k of missed) {
        const topic = pool.byKey.get(k).topic;
        byTopic.set(topic, (byTopic.get(topic) ?? 0) + 1);
      }
      const most = [...byTopic.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, MISSED_TOPICS_SHOWN)
        .map(([slug, n]) => `${pool.topics.find((t) => t.slug === slug)?.name ?? slug} (${n})`);
      const li = el("li", "missed-list__row");
      li.append(
        el("p", "missed-list__count", `${missed.length} missed in ${stateName(state)}`),
        el("p", "caption", `Most in ${most.join(", ")}`),
        Object.assign(el("a", "tool-btn", "Practice the ones you missed"), { href: learnUrl(cert, state, "?mode=cards&missed=1") }),
      );
      rows.push(li);
    }
    if (ticket !== pending) return;
    slot("missed-empty").hidden = rows.length > 0;
    list.hidden = rows.length === 0;
    list.replaceChildren(...rows);
  };

  // ---- What's stored, and the controls -------------------------------------------------------------

  const renderStored = (blob, states) => {
    const set = (key, value) => {
      document.querySelector(`[data-stored="${key}"]`).textContent = value;
    };
    const answers = states.reduce((n, s) => n + Object.values(s.record.answers ?? {}).reduce((m, h) => m + h.length, 0), 0);
    const tests = states.reduce((n, s) => n + (s.record.tests ?? []).length, 0);
    const stateCount = new Set(states.map((s) => s.state)).size;
    set("answers", answers ? `${answers} ${answers === 1 ? "answer" : "answers"} across ${stateCount} ${stateCount === 1 ? "state" : "states"}` : "None stored yet");
    set("tests", tests ? `${tests} ${tests === 1 ? "test" : "tests"}` : "None stored yet");
    set("cert", names.certs[blob.prefs?.cert]?.name ?? "None stored yet");
    set("state", blob.prefs?.state ? stateName(blob.prefs.state) : "None stored yet");
    set("tracking", blob.tracking ? "On" : "Off");

    const { persistent, readOnly } = store.status();
    const usable = persistent && !readOnly;
    for (const action of ["download", "erase", "tracking"]) {
      document.querySelector(`[data-action="${action}"]`).disabled = action === "download" ? false : !usable;
    }
    document.querySelector('[data-action="tracking"]').textContent = blob.tracking ? "Disable tracking" : "Turn tracking back on";
  };

  const status = (text) => {
    slot("status").textContent = text;
  };

  document.querySelector('[data-action="download"]').addEventListener("click", () => {
    const url = URL.createObjectURL(new Blob([store.exportBlob()], { type: "application/json" }));
    const link = Object.assign(el("a"), { href: url, download: `lanterncert-progress-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  document.querySelector('[data-action="erase"]').addEventListener("click", async () => {
    const erase = await confirm({
      title: "Erase all progress?",
      body: "This removes every answer, test result and preference stored in this browser. It can't be undone.",
      keep: "Keep my data",
      proceed: "Erase",
    });
    if (!erase) return;
    store.erase();
    status("Your progress was erased.");
  });

  document.querySelector('[data-action="tracking"]').addEventListener("click", async () => {
    if (!store.status().tracking) {
      store.setTracking(true);
      status("Progress tracking is on.");
      return;
    }
    const off = await confirm({
      title: "Turn off progress tracking?",
      body: "This erases what's stored now and stops saving new answers and results.",
      keep: "Keep tracking",
      proceed: "Turn off",
    });
    if (!off) return;
    store.setTracking(false);
    status("Progress tracking is off.");
  });

  // ---- Render ------------------------------------------------------------------------------------

  let pending = 0;
  async function render() {
    const ticket = ++pending;
    const blob = store.read();
    const states = used(blob);
    renderNext(blob, states.length > 0);
    renderActivity(states);
    renderStored(blob, states);
    await renderMissed(states, blob, ticket);
  }

  render();
  store.subscribe(render);
}
