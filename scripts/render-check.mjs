// Loads a built page in headless Chrome, evaluates a probe expression in it, and optionally
// screenshots one element. Serves /dist over localhost because ES modules are blocked on file://.
//
//   node scripts/render-check.mjs <page> [options]
//
//   <page>              path under /dist, e.g. "about/" or "motorcycle-endorsement/ga/"
//   --probe <file>      a file holding one JS expression; its value is printed
//   --shot <file>       write a PNG here
//   --clip <selector>   limit the shot to this element (default: the whole page)
//   --width, --height   window size in CSS pixels (default 1440x900)
//   --emulate <WxH>     a phone-sized viewport, below the ~500px floor a real window has
//   --dpr <n>           device scale factor (default 1)
//   --reduce            emulate prefers-reduced-motion, so two runs are comparable
//   --port <n>          local server port (default 8099)
//
// CHROME_PATH overrides browser discovery.

import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";

const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

/** Chrome, from the environment or from the usual place for this platform. */
function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const candidates = {
    win32: [
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
      "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
      join(process.env.LOCALAPPDATA ?? "", "Google/Chrome/Application/chrome.exe"),
      "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    ],
    darwin: [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ],
    linux: ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"],
  }[process.platform] ?? [];
  const found = candidates.find((p) => p && existsSync(p));
  if (!found) throw new Error("no Chrome found - set CHROME_PATH to the executable");
  return found;
}

/** Reads --flag values off argv; a flag with no value is a boolean. */
function options(argv) {
  const opt = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue;
    const next = argv[i + 1];
    opt[argv[i].slice(2)] = next && !next.startsWith("--") ? next : true;
  }
  return opt;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const args = process.argv.slice(2);
  const page = args.find((a) => !a.startsWith("--")) ?? "";
  const opt = options(args);
  const root = resolve(process.cwd(), "dist");
  const port = Number(opt.port ?? 8099);
  if (!existsSync(root)) throw new Error("no /dist - run npm run build first");

  const server = createServer(async (req, res) => {
    let path = decodeURIComponent(req.url.split("?")[0]);
    if (path.endsWith("/")) path += "index.html";
    try {
      const body = await readFile(join(root, path));
      res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end("");
    }
  });
  await new Promise((r) => server.listen(port, r));

  // A throwaway profile, in the system temp directory - never inside the repo.
  const profile = await mkdtemp(join(tmpdir(), "render-check-"));
  const chrome = spawn(
    findChrome(),
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      `--remote-debugging-port=${port + 1}`,
      `--window-size=${opt.width ?? 1440},${opt.height ?? 900}`,
      `--force-device-scale-factor=${opt.dpr ?? 1}`,
      `--user-data-dir=${profile}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  let targets = [];
  for (let i = 0; i < 60 && !targets.some((t) => t.type === "page"); i++) {
    try {
      targets = await (await fetch(`http://localhost:${port + 1}/json`)).json();
    } catch {
      /* the browser is still coming up */
    }
    if (!targets.some((t) => t.type === "page")) await wait(250);
  }
  const target = targets.find((t) => t.type === "page");
  if (!target) throw new Error("the browser never opened a page target");

  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => (socket.onopen = r));
  const pending = new Map();
  let id = 0;
  socket.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) pending.get(msg.id)(msg);
  };
  const send = (method, params = {}) =>
    new Promise((r) => {
      const n = ++id;
      pending.set(n, r);
      socket.send(JSON.stringify({ id: n, method, params }));
    });

  await send("Page.enable");
  // Emulated device metrics, which is the only way below the ~500px floor a real window has.
  if (opt.emulate) {
    const [w, h] = String(opt.emulate).split("x");
    await send("Emulation.setDeviceMetricsOverride", {
      width: Number(w),
      height: Number(h ?? opt.height ?? 900),
      deviceScaleFactor: Number(opt.dpr ?? 1),
      mobile: true,
    });
  }
  if (opt.reduce) {
    await send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-motion", value: "reduce" }],
    });
  }
  await send("Page.navigate", { url: `http://localhost:${port}/${String(page).replace(/^\/+/, "")}` });
  await wait(2500);

  if (opt.probe) {
    const result = await send("Runtime.evaluate", {
      expression: await readFile(opt.probe, "utf8"),
      returnByValue: true,
      awaitPromise: true,
    });
    const detail = result.result?.exceptionDetails;
    console.log(detail ? `probe threw: ${detail.text} ${detail.exception?.description ?? ""}` : result.result?.result?.value);
  }

  if (opt.shot) {
    const shot = { format: "png", captureBeyondViewport: true };
    if (opt.clip) {
      const box = await send("Runtime.evaluate", {
        expression: `JSON.stringify((()=>{const el=document.querySelector(${JSON.stringify(opt.clip)});
          if(!el) return null; const r=el.getBoundingClientRect();
          return {x:r.x,y:r.y+scrollY,width:r.width,height:r.height,scale:1};})())`,
        returnByValue: true,
      });
      const clip = JSON.parse(box.result?.result?.value ?? "null");
      if (!clip) throw new Error(`no element matched ${opt.clip}`);
      shot.clip = clip;
    }
    const png = await send("Page.captureScreenshot", shot);
    await writeFile(opt.shot, Buffer.from(png.result.data, "base64"));
    console.log(`wrote ${opt.shot}`);
  }

  socket.close();
  chrome.kill();
  server.close();
}

try {
  await main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
process.exit(process.exitCode ?? 0);
