// Source-page fetcher for content work. Renders with headless Chrome so JS-built pages return
// their real text, and answers from the snapshot store whenever one is fresh enough to reuse.

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const SNAPSHOT_DIR = join(ROOT, "blackbox", "source-snapshots");
export const PRIMARY_SOURCE_DIR = join(ROOT, "blackbox", "primary-sources");
export const SNAPSHOT_MAX_AGE_DAYS = 60;

// Every request is a chance to trip a bot rule, so they are spaced and never made in parallel.
const REQUEST_SPACING_MS = 2000;
const CHROME_TIMEOUT_MS = 45000;
const VIRTUAL_TIME_BUDGET_MS = 15000;

// A rendered page below this many characters is treated as a failed render, not thin content.
const MIN_PLAUSIBLE_TEXT = 400;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

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

async function space() {
  const wait = lastRequestAt + REQUEST_SPACING_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
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
    `--user-agent=${USER_AGENT}`,
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
 * Preferred PDF reader. pdf-parse resolves each font's ToUnicode map, which is what subset-encoded
 * PDFs need — DL 665 R2-2024 extracts as mojibake without it. Falls back to the hand-rolled reader
 * below when the library is absent or refuses the file; an encrypted PDF defeats both.
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

// Fallback PDF text layer reader: inflate each content stream and keep the strings fed to the
// text-showing operators. Returns "" for scanned or otherwise text-free PDFs, which is the signal
// to read the file in primary-sources/ by hand instead.
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

export function snapshotPath(key) {
  return join(SNAPSHOT_DIR, `${key}.json`);
}

export function readSnapshot(key) {
  const path = snapshotPath(key);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
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
async function fetchBinaryMeta(url, key) {
  await space();
  let res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });

  // Some hosts do the opposite of the usual bot rule and block the browser UA — ridesmartflorida.com
  // serves a plain request fine and 403s a Chrome one. Retry bare before believing the refusal.
  if (res.status === 403) {
    await space();
    res = await fetch(url);
  }

  const bytes = Buffer.from(await res.arrayBuffer());

  const contentType = res.headers.get("content-type") ?? "";
  const isPdf = /pdf/i.test(contentType) || bytes.subarray(0, 5).toString("latin1") === "%PDF-";

  let localPath = null;
  if (key && res.ok) {
    mkdirSync(PRIMARY_SOURCE_DIR, { recursive: true });
    // Agencies serve documents from extension-less endpoints, so the body decides the extension.
    const ext = (url.match(/\.([a-z0-9]+)(?:\?|#|$)/i)?.[1] ?? (isPdf ? "pdf" : "bin")).toLowerCase();
    localPath = join(PRIMARY_SOURCE_DIR, `${key}.${ext}`);
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
  await space();
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

/**
 * Returns { snapshot, fromCache, previousHash }. Never touches the network when a stored
 * snapshot is younger than SNAPSHOT_MAX_AGE_DAYS and `force` is not set.
 */
export async function getPage({ key, url, force = false, maxAgeDays = SNAPSHOT_MAX_AGE_DAYS }) {
  const stored = key ? readSnapshot(key) : null;

  // A retargeted citation invalidates its snapshot no matter how fresh — the key is the same but
  // the document is not.
  const sameUrl = stored?.url === url;

  if (stored && sameUrl && !force && ageInDays(stored.fetchedAt) < maxAgeDays) {
    return { snapshot: stored, fromCache: true, previousHash: stored.hash };
  }

  // Agency document endpoints hide the type in the path — /download, or CA DMV's /file/<name>-pdf/.
  // Chrome would return a viewer shell for these, so route them to the binary path instead.
  const isBinary =
    /\.(pdf|zip|docx?|xlsx?)(\?|#|$)/i.test(url) ||
    /\/download\/?(\?|#|$)/i.test(url) ||
    /-(pdf|docx?|xlsx?)\/?(\?|#|$)/i.test(url);
  let result;
  try {
    result = isBinary ? await fetchBinaryMeta(url, key) : await fetchRendered(url);
  } catch (err) {
    result = {
      status: -1,
      finalUrl: url,
      contentType: "",
      method: isBinary ? "binary" : "chrome",
      textLength: 0,
      byteLength: 0,
      hash: null,
      text: null,
      error: err.message,
    };
  }

  const snapshot = { key: key ?? null, url, fetchedAt: today(), ...result };

  if (key && snapshot.status > 0) {
    mkdirSync(SNAPSHOT_DIR, { recursive: true });
    writeFileSync(snapshotPath(key), JSON.stringify(snapshot, null, 2) + "\n", "utf8");
  }

  return { snapshot, fromCache: false, previousHash: stored?.hash ?? null };
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  const args = process.argv.slice(2);
  const url = args.find((a) => !a.startsWith("--"));
  const keyArg = args.indexOf("--key");
  const key = keyArg !== -1 ? args[keyArg + 1] : null;
  const force = args.includes("--force");

  if (!url) {
    console.error("fetch-page: usage — node scripts/fetch-page.mjs <url> [--key <source-key>] [--force]");
    process.exit(1);
  }

  const { snapshot, fromCache } = await getPage({ key, url, force });
  const age = ageInDays(snapshot.fetchedAt);
  console.error(
    `fetch-page: ${fromCache ? `cache (${age}d old)` : snapshot.method} — status ${snapshot.status}, ${snapshot.textLength} chars`
  );
  if (snapshot.error) console.error(`fetch-page: ${snapshot.error}`);
  if (snapshot.text) console.log(snapshot.text);
}
