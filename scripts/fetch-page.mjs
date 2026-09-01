// Source-page fetcher for content work. Renders with headless Chrome so JS-built pages return
// their real text, and answers from the snapshot store whenever one is fresh enough to reuse.

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const SNAPSHOT_DIR = join(ROOT, "blackbox", "source-snapshots");
export const SNAPSHOT_HISTORY_DIR = join(ROOT, "blackbox", "source-snapshots-history");
export const PRIMARY_SOURCE_DIR = join(ROOT, "blackbox", "primary-sources");
export const SNAPSHOT_MAX_AGE_DAYS = 21;

// Every request is a chance to trip a bot rule, so they are spaced and never made in parallel.
const REQUEST_SPACING_MS = 2000;

// ================== REQUEST GUARD - THE KNOBS LIVE HERE ==================
// How hard this tool may lean on ONE host. Raising any of these is a decision about somebody
// else's server, not a performance setting. State persists in blackbox/request-guard.json,
// because every invocation is its own process and in-memory counters would reset each time.
const GUARD = {
  // Failed attempts in a row against one host before it is refused outright.
  challengeStrikes: 2,
  // Requests allowed to one host inside the rolling window.
  hostRequestCap: 20,
  // Minutes the cap is measured over, and how long a tripped host stays refused.
  hostWindowMinutes: 60,
  // Seconds between requests to the SAME host, on top of the global spacing above.
  hostSpacingSeconds: 5,
  // Turn the whole breaker off for offline or fixture work.
  enabled: true,
};
// ==========================================================================
const CHROME_TIMEOUT_MS = 45000;
const VIRTUAL_TIME_BUDGET_MS = 15000;

// A rendered page below this many characters is treated as a failed render, not thin content.
const MIN_PLAUSIBLE_TEXT = 400;

// For the plain-fetch path only, which has no browser of its own to introduce it.
// NEVER hand this to Chrome: a version string that disagrees with the binary reads as a forgery,
// which is what made every Cloudflare host serve a challenge instead of a page.
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36";

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  join(process.env.LOCALAPPDATA ?? "", "Google\\Chrome\\Application\\chrome.exe"),
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);

// Reusing one profile keeps cookies between runs, which bot filters read as a returning visitor.
const CHROME_PROFILE = join(tmpdir(), "lanterncert-chrome-profile");

let lastRequestAt = 0;

function findChrome() {
  const hit = CHROME_CANDIDATES.find((p) => existsSync(p));
  if (!hit) {
    throw new Error(
      "no Chrome or Edge found — set CHROME_PATH to a chrome.exe or msedge.exe"
    );
  }
  return hit;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const GUARD_STATE = join(ROOT, "blackbox", "request-guard.json");

function hostOf(url) {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
}

function loadGuard() {
  if (!existsSync(GUARD_STATE)) return {};
  try {
    return JSON.parse(readFileSync(GUARD_STATE, "utf8"));
  } catch {
    // Unreadable state must not stop the run; a fresh record is the safe default.
    return {};
  }
}

function saveGuard(state) {
  mkdirSync(dirname(GUARD_STATE), { recursive: true });
  writeFileSync(GUARD_STATE, JSON.stringify(state, null, 2) + "\n", "utf8");
}

const withinWindow = (stamp) => Date.now() - Date.parse(stamp) < GUARD.hostWindowMinutes * 60000;

/** Why this host may not be requested right now, or null to proceed. */
export function guardCheck(url) {
  const host = GUARD.enabled ? hostOf(url) : null;
  const entry = host ? loadGuard()[host] : null;
  if (!entry) return null;

  if (entry.trippedAt && withinWindow(entry.trippedAt)) {
    const left = Math.ceil(
      (GUARD.hostWindowMinutes * 60000 - (Date.now() - Date.parse(entry.trippedAt))) / 60000,
    );
    return `${host} is refused for another ${left} min - ${entry.reason}`;
  }
  const recent = (entry.hits ?? []).filter(withinWindow);
  if (recent.length >= GUARD.hostRequestCap) {
    return `${host} has had ${recent.length} requests in ${GUARD.hostWindowMinutes} min, at the cap`;
  }
  return null;
}

/** Records the outcome of a whole attempt; consecutive failures are what trip the breaker. */
export function guardStrike(url, failed) {
  const host = GUARD.enabled ? hostOf(url) : null;
  if (!host) return;
  const state = loadGuard();
  const entry = state[host] ?? { hits: [], strikes: 0, trippedAt: null, reason: null };

  entry.strikes = failed ? (entry.strikes ?? 0) + 1 : 0;
  if (!failed) {
    entry.trippedAt = null;
    entry.reason = null;
  } else if (entry.strikes >= GUARD.challengeStrikes) {
    entry.trippedAt = new Date().toISOString();
    entry.reason = `${entry.strikes} failed attempts in a row`;
  }
  state[host] = entry;
  saveGuard(state);
}

export function guardStatus() {
  const state = loadGuard();
  return Object.entries(state).map(([host, entry]) => ({
    host,
    recentRequests: (entry.hits ?? []).filter(withinWindow).length,
    strikes: entry.strikes ?? 0,
    refused: Boolean(entry.trippedAt && withinWindow(entry.trippedAt)),
  }));
}

// The one chokepoint every outbound request passes through, so the per-host tally lives here.
async function space(url = null) {
  const host = GUARD.enabled ? hostOf(url) : null;
  if (host) {
    const state = loadGuard();
    const entry = state[host] ?? { hits: [], strikes: 0, trippedAt: null, reason: null };
    const recent = (entry.hits ?? []).filter(withinWindow);
    const last = recent.length ? Date.parse(recent[recent.length - 1]) : 0;
    const hostWait = last + GUARD.hostSpacingSeconds * 1000 - Date.now();
    if (hostWait > 0) await sleep(hostWait);
    entry.hits = [...recent, new Date().toISOString()];
    state[host] = entry;
    saveGuard(state);
  }
  const wait = lastRequestAt + REQUEST_SPACING_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
}

function renderWithChrome(url) {
  const chrome = findChrome();
  const args = [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    // Without this, Imperva/Incapsula sites serve a challenge page instead of content.
    "--disable-blink-features=AutomationControlled",
    `--user-data-dir=${CHROME_PROFILE}`,
    `--virtual-time-budget=${VIRTUAL_TIME_BUDGET_MS}`,
    "--dump-dom",
    url,
  ];

  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(chrome, args, { windowsHide: true });
    let html = "";
    const timer = setTimeout(() => {
      child.kill();
      rejectPromise(new Error(`render timed out after ${CHROME_TIMEOUT_MS}ms`));
    }, CHROME_TIMEOUT_MS);

    child.stdout.on("data", (chunk) => (html += chunk));
    child.on("error", (err) => {
      clearTimeout(timer);
      rejectPromise(err);
    });
    child.on("close", () => {
      clearTimeout(timer);
      resolvePromise(html);
    });
  });
}

export function extractText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function hash(text) {
  return "sha256:" + createHash("sha256").update(text).digest("hex").slice(0, 32);
}

/**
 * Preferred PDF reader: pdf-parse resolves ToUnicode maps, which subset-encoded PDFs need.
 * Falls back to the reader below; an encrypted PDF defeats both.
 */
export async function readPdfText(buf) {
  try {
    const { PDFParse } = await import("pdf-parse");
    const { text } = await new PDFParse({ data: buf }).getText();
    if (text?.trim()) return text.trim();
  } catch {
    // Library missing, or encrypted/malformed input — the fallback reports emptiness honestly.
  }
  return extractPdfText(buf);
}

// Fallback PDF text reader. Returns "" for scanned PDFs - the signal to read the file by hand.
export function extractPdfText(buf) {
  const streams = [];
  let pos = 0;
  while (true) {
    const start = buf.indexOf("stream", pos);
    if (start === -1) break;
    const end = buf.indexOf("endstream", start);
    if (end === -1) break;
    let s = start + 6;
    if (buf[s] === 0x0d) s++;
    if (buf[s] === 0x0a) s++;
    try {
      streams.push(inflateSync(buf.subarray(s, end)).toString("latin1"));
    } catch {
      const raw = buf.subarray(s, end).toString("latin1");
      if (/\bT[Jj]\b/.test(raw)) streams.push(raw);
    }
    pos = end + 9;
  }

  const literal = /\((?:\\.|[^\\()])*\)/g;
  const lines = [];
  for (const block of streams.join("\n").split(/(?=BT\b)/)) {
    if (!/\bT[Jj]\b/.test(block)) continue;
    const parts = block.match(literal);
    if (!parts) continue;
    lines.push(
      parts
        .map((p) =>
          p
            .slice(1, -1)
            .replace(/\\([0-7]{1,3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)))
            .replace(/\\(.)/g, "$1")
        )
        .join("")
    );
  }

  return lines.join(" ").replace(/￾|þÿ/g, " ").replace(/\s+/g, " ").trim();
}

// All three stores are partitioned by cert slug, so one cert's material stays a browsable set as the
// registry grows — and so two certs holding the same key never overwrite each other's document.
export function snapshotPath(cert, key) {
  return join(SNAPSHOT_DIR, cert, `${key}.json`);
}

export function primarySourcePath(cert, key, ext) {
  return join(PRIMARY_SOURCE_DIR, cert, `${key}.${ext}`);
}

export function readSnapshot(cert, key) {
  const path = snapshotPath(cert, key);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

export function historyPath(cert, key, stamp) {
  return join(SNAPSHOT_HISTORY_DIR, cert, key, `${stamp}.json`);
}

// Files the superseded snapshot under the last date its content was confirmed live, keeping both of
// its dates untouched so the pair still brackets the window that content was actually up.
export function archiveSnapshot(cert, stored) {
  const stamp = stored.mostRecentValidation ?? stored.originallyFetched ?? today();
  mkdirSync(join(SNAPSHOT_HISTORY_DIR, cert, stored.key), { recursive: true });
  let path = historyPath(cert, stored.key, stamp);
  for (let n = 2; existsSync(path); n++) path = historyPath(cert, stored.key, `${stamp}-${n}`);
  // HISTORICAL leads the object so an archived copy is never mistaken for a live one at a glance.
  writeFileSync(path, JSON.stringify({ HISTORICAL: true, ...stored }, null, 2) + "\n", "utf8");
  return path;
}

export function ageInDays(iso) {
  if (!iso) return Infinity;
  return Math.floor((Date.now() - Date.parse(iso)) / 86400000);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// Chrome renders a PDF into its viewer shell, not into text, so binaries are saved to
// primary-sources/ instead and read from there. The snapshot holds the digest, never the document.
async function fetchBinaryMeta(url, cert, key) {
  await space(url);
  let res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });

  // Some hosts do the opposite of the usual bot rule and block the browser UA — ridesmartflorida.com
  // serves a plain request fine and 403s a Chrome one. Retry bare before believing the refusal.
  if (res.status === 403) {
    await space(url);
    res = await fetch(url);
  }

  const bytes = Buffer.from(await res.arrayBuffer());

  const contentType = res.headers.get("content-type") ?? "";
  const isPdf = /pdf/i.test(contentType) || bytes.subarray(0, 5).toString("latin1") === "%PDF-";

  let localPath = null;
  if (key && res.ok) {
    mkdirSync(join(PRIMARY_SOURCE_DIR, cert), { recursive: true });
    // Agencies serve documents from extension-less endpoints, so the body decides the extension.
    const ext = (url.match(/\.([a-z0-9]+)(?:\?|#|$)/i)?.[1] ?? (isPdf ? "pdf" : "bin")).toLowerCase();
    localPath = primarySourcePath(cert, key, ext);
    writeFileSync(localPath, bytes);
  }

  const text = isPdf ? await readPdfText(bytes) : "";

  return {
    status: res.status,
    finalUrl: res.url,
    contentType: res.headers.get("content-type") ?? "",
    method: "binary",
    localPath,
    title: null,
    canonical: null,
    textLength: text.length,
    byteLength: bytes.length,
    hash: "sha256:" + createHash("sha256").update(bytes).digest("hex").slice(0, 32),
    text: text || null,
  };
}

// --dump-dom reports no HTTP status and no redirect chain, so the page's own title and canonical
// URL stand in: they are what reveal a soft 404 or a citation that now lands somewhere else.
function readPageIdentity(html) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]*>/i);
  return {
    title: title ? extractText(title[1]).slice(0, 200) : null,
    canonical: canonical ? (canonical[0].match(/href=["']([^"']+)["']/i)?.[1] ?? null) : null,
  };
}

async function fetchRendered(url) {
  await space(url);
  const html = await renderWithChrome(url);
  const text = extractText(html);
  return {
    // Synthesized, not an HTTP status: a render either produced usable text or it did not.
    status: text.length >= MIN_PLAUSIBLE_TEXT ? 200 : 0,
    finalUrl: url,
    contentType: "text/html",
    method: "chrome",
    ...readPageIdentity(html),
    textLength: text.length,
    byteLength: html.length,
    hash: hash(text),
    text,
  };
}

// ===================== FALLBACK: real-browser fetching =====================
// Reached only when the fast path above comes back empty or refused. It drives a real Chrome over
// the DevTools protocol, which waits out a bot challenge and reads what a plain fetch cannot.

// Chrome is given a long leash here because this path only ever runs after a cheap attempt failed.
const CDP_SETTLE_MS = 60000;
const CDP_POLL_MS = 1000;
// A page that reads fine but never stops repainting is taken anyway after this many polls.
const CDP_RESTLESS_POLLS = 4;
const CDP_LAUNCH_MS = 20000;
// A 200 can also lie by being a bot interstitial or a block notice, alongside the soft 404.
const CHALLENGE_TEXT =
  /just a moment|performing security verification|checking your browser|enable javascript and cookies|attention required|you have been blocked|unable to access|ray id/i;

// Well above any interstitial and well below a real agency page, which runs to five figures.
const CHALLENGE_MAX_CHARS = 3000;

export function isChallenge(text) {
  return (text ?? "").length < CHALLENGE_MAX_CHARS && CHALLENGE_TEXT.test(text ?? "");
}

// A snapshot may only ever be written from a real document, which an error page is not.
function usable(result) {
  return result.status >= 200 && result.status < 400 && (result.textLength > 0 || result.byteLength > 0);
}

// Chrome announces its DevTools endpoint on stderr and nowhere else.
function readDevtoolsUrl(child) {
  return new Promise((resolvePromise, rejectPromise) => {
    let buffer = "";
    const timer = setTimeout(
      () => rejectPromise(new Error("chrome never announced a DevTools port")),
      CDP_LAUNCH_MS,
    );
    const onData = (chunk) => {
      buffer += chunk;
      const hit = buffer.match(/DevTools listening on (ws:\/\/\S+)/);
      if (!hit) return;
      clearTimeout(timer);
      child.stderr.off("data", onData);
      resolvePromise(hit[1]);
    };
    child.stderr.on("data", onData);
    child.on("error", (err) => {
      clearTimeout(timer);
      rejectPromise(err);
    });
  });
}

// Minimal JSON-RPC over the DevTools socket; Node supplies the WebSocket, so this needs no package.
function openCdp(wsUrl) {
  const socket = new WebSocket(wsUrl);
  const pending = new Map();
  let nextId = 0;

  const ready = new Promise((resolvePromise, rejectPromise) => {
    socket.onopen = () => resolvePromise();
    socket.onerror = () => rejectPromise(new Error("DevTools socket refused the connection"));
  });

  const listeners = new Map();

  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.method) {
      listeners.get(message.method)?.forEach((handler) => handler(message.params ?? {}));
      return;
    }
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(message.error.message));
    else waiter.resolve(message.result);
  };

  const on = (method, handler) => {
    if (!listeners.has(method)) listeners.set(method, []);
    listeners.get(method).push(handler);
  };

  const send = (method, params = {}) =>
    new Promise((resolvePromise, rejectPromise) => {
      const id = ++nextId;
      pending.set(id, { resolve: resolvePromise, reject: rejectPromise });
      socket.send(JSON.stringify({ id, method, params }));
    });

  return { ready, send, on, close: () => socket.close() };
}

/**
 * Runs `job` against a live Chrome page, then always tears the browser down.
 * `job` receives { evaluate, settle } - `settle` navigates and waits for real content to appear.
 */
async function withBrowser(job) {
  const chrome = findChrome();
  // Failed challenges accumulate against a profile until the host blocks it outright, so this
  // path always starts clean and throws the profile away afterwards.
  const profile = join(tmpdir(), `lanterncert-cdp-${Date.now()}`);
  const child = spawn(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      "--window-size=1280,1024",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-blink-features=AutomationControlled",
      "--lang=en-US",
      `--user-data-dir=${profile}`,
      "--remote-debugging-port=0",
      "about:blank",
    ],
    { windowsHide: true },
  );

  try {
    const wsUrl = await readDevtoolsUrl(child);
    const port = wsUrl.match(/:(\d+)\//)[1];
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const target = targets.find((t) => t.type === "page");
    if (!target) throw new Error("chrome exposed no page target");

    const cdp = openCdp(target.webSocketDebuggerUrl);
    await cdp.ready;
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
      source: "Object.defineProperty(navigator, 'webdriver', { get: () => undefined });",
    });

    const evaluate = async (expression, awaitPromise = false) => {
      const reply = await cdp.send("Runtime.evaluate", {
        expression,
        awaitPromise,
        returnByValue: true,
      });
      if (reply.exceptionDetails) throw new Error(reply.exceptionDetails.text ?? "page script threw");
      return reply.result?.value ?? null;
    };

    // Polls until the page stops looking like a challenge and its text stops moving.
    const settle = async (url) => {
      await space(url);
      await cdp.send("Page.navigate", { url });
      const deadline = Date.now() + CDP_SETTLE_MS;
      let previousText = "";
      let goodPolls = 0;
      let best = "";
      while (Date.now() < deadline) {
        await sleep(CDP_POLL_MS);
        let html = "";
        try {
          html = (await evaluate("document.documentElement.outerHTML")) ?? "";
        } catch {
          continue;
        }
        const text = extractText(html);
        if (text.length > extractText(best).length) best = html;
        // Compared as text, not markup: a carousel or an analytics tag rewrites markup forever.
        if (text.length >= MIN_PLAUSIBLE_TEXT && !isChallenge(text)) {
          if (text === previousText || ++goodPolls >= CDP_RESTLESS_POLLS) return html;
        } else {
          goodPolls = 0;
        }
        previousText = text;
      }
      // Hand back the fullest thing seen rather than nothing; the caller still judges it.
      return best;
    };

    return await job({ send: cdp.send, on: cdp.on, evaluate, settle });
  } finally {
    child.kill();
    try {
      rmSync(profile, { recursive: true, force: true });
    } catch {
      // A profile Chrome has not finished releasing is temp-directory litter, not a failure.
    }
  }
}

async function fetchRenderedViaBrowser(url) {
  const html = await withBrowser(({ settle }) => settle(url));
  const text = extractText(html);
  return {
    status: text.length >= MIN_PLAUSIBLE_TEXT && !isChallenge(text) ? 200 : 0,
    finalUrl: url,
    contentType: "text/html",
    method: "cdp",
    ...readPageIdentity(html),
    textLength: text.length,
    byteLength: html.length,
    hash: hash(text),
    text,
  };
}

// Intercepted at the response stage, because a document request Chrome hands to its PDF viewer
// never reports a response on the page's own network events - it reports a failure.
async function fetchBinaryViaBrowser(url, cert, key) {
  const captured = await withBrowser(async ({ send, on }) => {
    const bare = (candidate) => candidate.split("?")[0];
    let result = null;

    on("Fetch.requestPaused", async (params) => {
      const isTarget = bare(params.request.url) === bare(url);
      // A paused request must always be released, or the navigation stalls behind it.
      if (isTarget && params.responseStatusCode !== undefined && !result) {
        try {
          const body = await send("Fetch.getResponseBody", { requestId: params.requestId });
          const header = (params.responseHeaders ?? []).find((h) => /^content-type$/i.test(h.name));
          result = { ...body, status: params.responseStatusCode, contentType: header?.value ?? "" };
        } catch {
          // Left null so the caller reports a miss rather than a corrupt capture.
        }
      }
      await send("Fetch.continueRequest", { requestId: params.requestId }).catch(() => {});
    });

    await send("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Response" }] });
    await space(url);
    // A navigation that turns into a download reports itself as aborted, which is not a failure.
    await send("Page.navigate", { url }).catch(() => {});

    const deadline = Date.now() + CDP_SETTLE_MS;
    while (Date.now() < deadline) {
      await sleep(CDP_POLL_MS);
      if (result) return result;
    }
    return null;
  });

  if (!captured) throw new Error("no response body captured for that url");
  const bytes = Buffer.from(captured.body, captured.base64Encoded ? "base64" : "utf8");
  const isPdf = /pdf/i.test(captured.contentType) || bytes.subarray(0, 5).toString("latin1") === "%PDF-";

  let localPath = null;
  if (key && captured.status >= 200 && captured.status < 400) {
    mkdirSync(join(PRIMARY_SOURCE_DIR, cert), { recursive: true });
    const ext = (url.match(/\.([a-z0-9]+)(?:\?|#|$)/i)?.[1] ?? (isPdf ? "pdf" : "bin")).toLowerCase();
    localPath = primarySourcePath(cert, key, ext);
    writeFileSync(localPath, bytes);
  }

  const text = isPdf ? await readPdfText(bytes) : extractText(bytes.toString("utf8"));
  return {
    status: captured.status,
    finalUrl: url,
    contentType: captured.contentType,
    method: "cdp-binary",
    localPath,
    title: null,
    canonical: null,
    textLength: text.length,
    byteLength: bytes.length,
    hash: "sha256:" + createHash("sha256").update(bytes).digest("hex").slice(0, 32),
    text: text || null,
  };
}

// Last resort for a document no automated path can reach: the file is supplied, the URL still cited.
async function importLocalFile(url, cert, key, filePath) {
  const bytes = readFileSync(filePath);
  const isPdf = bytes.subarray(0, 5).toString("latin1") === "%PDF-";
  const html = isPdf ? "" : bytes.toString("utf8");
  const text = isPdf ? await readPdfText(bytes) : extractText(html);

  let localPath = null;
  if (key) {
    mkdirSync(join(PRIMARY_SOURCE_DIR, cert), { recursive: true });
    const ext = (filePath.match(/\.([a-z0-9]+)$/i)?.[1] ?? (isPdf ? "pdf" : "bin")).toLowerCase();
    localPath = primarySourcePath(cert, key, ext);
    writeFileSync(localPath, bytes);
  }

  return {
    status: text.length > 0 ? 200 : 0,
    finalUrl: url,
    contentType: isPdf ? "application/pdf" : "text/html",
    method: "manual",
    localPath,
    ...(isPdf ? { title: null, canonical: null } : readPageIdentity(html)),
    textLength: text.length,
    byteLength: bytes.length,
    hash: isPdf
      ? "sha256:" + createHash("sha256").update(bytes).digest("hex").slice(0, 32)
      : hash(text),
    text: text || null,
  };
}

/**
 * Returns { snapshot, fromCache, previousHash, changed, written, archivedTo, mismatch }.
 * A detected change is NEVER written unprompted; `apply` commits a reviewed one.
 */
export async function getPage({
  cert,
  key,
  url,
  force = false,
  maxAgeDays = SNAPSHOT_MAX_AGE_DAYS,
  apply = null,
  expectHash = null,
  via = null,
  importFile = null,
}) {
  if (key && !cert) throw new Error("getPage: a key needs a cert — snapshots are stored per cert");
  const stored = key ? readSnapshot(cert, key) : null;

  // A retargeted citation invalidates its snapshot no matter how fresh — the key is the same but
  // the document is not.
  const sameUrl = stored?.url === url;

  if (stored && sameUrl && !force && ageInDays(stored.mostRecentValidation) < maxAgeDays) {
    return {
      snapshot: stored,
      fromCache: true,
      previousHash: stored.hash,
      changed: false,
      written: false,
      archivedTo: null,
    };
  }

  // Agency document endpoints hide the type in the path — /download, or CA DMV's /file/<name>-pdf/.
  // Chrome would return a viewer shell for these, so route them to the binary path instead.
  const isBinary =
    /\.(pdf|zip|docx?|xlsx?)(\?|#|$)/i.test(url) ||
    /\/download\/?(\?|#|$)/i.test(url) ||
    /-(pdf|docx?|xlsx?)\/?(\?|#|$)/i.test(url);
  const viaBrowser = () =>
    isBinary ? fetchBinaryViaBrowser(url, cert, key) : fetchRenderedViaBrowser(url);

  // A host that has already refused us twice is not asked a third time; that is what escalates
  // a solvable challenge into a block on the whole domain.
  const refusal = importFile ? null : guardCheck(url);

  let result;
  try {
    if (refusal) {
      result = {
        status: 0,
        finalUrl: url,
        contentType: "",
        method: "refused",
        textLength: 0,
        byteLength: 0,
        hash: null,
        text: null,
        error: `request guard: ${refusal}`,
      };
    } else if (importFile) {
      result = await importLocalFile(url, cert, key, importFile);
    } else if (via === "cdp") {
      result = await viaBrowser();
    } else {
      result = isBinary ? await fetchBinaryMeta(url, cert, key) : await fetchRendered(url);
      // The cheap attempt already failed, so a real browser is the only thing left to try.
      if (!usable(result) || isChallenge(result.text)) {
        const fast = result;
        try {
          result = await viaBrowser();
        } catch (err) {
          result = { ...fast, error: `fallback failed: ${err.message}` };
        }
      }
    }
    if (!refusal && !importFile) guardStrike(url, !usable(result) || isChallenge(result.text));
  } catch (err) {
    if (!refusal && !importFile) guardStrike(url, true);
    result = {
      status: -1,
      finalUrl: url,
      contentType: "",
      method: `${via === "cdp" ? "cdp" : "fast"}-${isBinary ? "binary" : "render"}`,
      textLength: 0,
      byteLength: 0,
      hash: null,
      text: null,
      error: err.message,
    };
  }

  const changed = Boolean(stored && sameUrl && stored.hash && result.hash && stored.hash !== result.hash);

  const candidate = {
    cert: cert ?? null,
    key: key ?? null,
    url,
    originallyFetched: stored?.originallyFetched ?? null,
    mostRecentValidation: stored?.mostRecentValidation ?? null,
    ...result,
  };

  // Nothing unreviewed reaches the store. Re-running costs one request; a record written from a
  // change nobody looked at would outlive the mistake that made it.
  if (changed && !apply) {
    return { snapshot: candidate, fromCache: false, previousHash: stored.hash, changed: true, written: false, archivedTo: null };
  }

  // Guards the window between a change being reported and being approved: if the page moved again
  // in between, the approval was given for content that is no longer there.
  if (expectHash && result.hash !== expectHash) {
    return { snapshot: candidate, fromCache: false, previousHash: stored?.hash ?? null, changed, written: false, archivedTo: null, mismatch: true };
  }

  // A retarget is a deliberate registry edit, so it needs no review gate — but the superseded
  // document is still history, and overwriting it here is the data loss this store exists to stop.
  const retargeted = Boolean(stored && !sameUrl);
  let archivedTo = null;
  // Only ever supersede a snapshot with something real — a failed fetch would otherwise retire the
  // old copy into history and leave nothing live to replace it.
  if (stored && usable(result) && (retargeted || (changed && apply === "meaningful"))) {
    archivedTo = archiveSnapshot(cert, stored);
  }

  const snapshot = {
    ...candidate,
    // Sticky: set only when there is no window to continue — a new record, or one whose
    // predecessor was just archived.
    originallyFetched: stored?.originallyFetched && !archivedTo ? stored.originallyFetched : today(),
    mostRecentValidation: today(),
  };

  const written = Boolean(key && usable(snapshot));
  if (written) {
    mkdirSync(join(SNAPSHOT_DIR, cert), { recursive: true });
    writeFileSync(snapshotPath(cert, key), JSON.stringify(snapshot, null, 2) + "\n", "utf8");
  }

  return { snapshot, fromCache: false, previousHash: stored?.hash ?? null, changed, written, archivedTo };
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  const args = process.argv.slice(2);
  if (args.includes("--guard-status")) {
    const rows = guardStatus();
    if (!rows.length) console.log("request guard: no hosts recorded");
    for (const r of rows) {
      console.log(
        `  ${r.refused ? "REFUSED" : "ok     "}  ${r.host} - ${r.recentRequests} requests in window, ${r.strikes} strikes`,
      );
    }
    process.exit(0);
  }

  const url = args.find((a) => !a.startsWith("--"));
  const keyArg = args.indexOf("--key");
  const key = keyArg !== -1 ? args[keyArg + 1] : null;
  const certArg = args.indexOf("--cert");
  const cert = certArg !== -1 ? args[certArg + 1] : null;
  const applyArg = args.indexOf("--apply");
  const apply = applyArg !== -1 ? args[applyArg + 1] : null;
  const expectArg = args.indexOf("--expect-hash");
  const expectHash = expectArg !== -1 ? args[expectArg + 1] : null;
  const force = args.includes("--force");
  const via = args.includes("--cdp") ? "cdp" : null;
  const importArg = args.indexOf("--import");
  const importFile = importArg !== -1 ? args[importArg + 1] : null;

  if (!url || (key && !cert) || (apply && !["cosmetic", "meaningful"].includes(apply))) {
    console.error(
      "fetch-page: usage — node scripts/fetch-page.mjs <url> [--cert <slug> --key <source-key>]\n" +
        "                    [--force] [--apply cosmetic|meaningful] [--expect-hash <hash>]\n" +
        "                    [--cdp] drive a real browser, for a host that blocks the fast path\n" +
        "                    [--import <file>] store a hand-downloaded file under this url\n" +
        "                    --key requires --cert: snapshots are stored per cert."
    );
    process.exit(1);
  }

  const { snapshot, fromCache, changed, written, archivedTo, mismatch } = await getPage({
    cert,
    key,
    url,
    force,
    apply,
    expectHash,
    via,
    importFile,
  });
  const age = ageInDays(snapshot.mostRecentValidation);
  console.error(
    `fetch-page: ${fromCache ? `cache (${age}d old)` : snapshot.method} — status ${snapshot.status}, ${snapshot.textLength} chars`
  );
  if (mismatch) console.error(`fetch-page: MISMATCH — page is ${snapshot.hash}, expected ${expectHash}. Nothing written.`);
  else if (changed && !written) console.error(`fetch-page: CHANGED — candidate ${snapshot.hash}. Nothing written; review, then --apply.`);
  if (archivedTo) {
    console.error(`fetch-page: archived previous snapshot to ${archivedTo}`);
    console.error(`fetch-page: REDATE — new content window, so re-review published and verifiedCurrentIn.`);
  }
  if (snapshot.error) console.error(`fetch-page: ${snapshot.error}`);
  if (snapshot.text) console.log(snapshot.text);
}
