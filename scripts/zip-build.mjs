// Local build-record archiver — runs after `npm run build` via the "postbuild" hook and zips
// the fresh /dist into /builds as a dated version record. Local only; /builds is gitignored.

import { existsSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

// CI guard: never archive on a hosted builder.
if (process.env.CI) {
  console.log("zip-build: CI environment detected — skipping local build archive.");
  process.exit(0);
}

if (!existsSync("dist")) {
  console.error("zip-build: no /dist found — run via `npm run build` from the project root.");
  process.exit(1);
}

mkdirSync("builds", { recursive: true });

const now = new Date();
const stamp = `${now.getMonth() + 1}-${now.getDate()}-${now.getFullYear()}`;
const dest = `builds/lanterncert-build-${stamp}.zip`;

// Zip the CONTENTS of dist, so files sit at the zip root with no dist/ wrapper.
// -Force refreshes a same-day archive rather than erroring.
const result = spawnSync(
  "powershell.exe",
  ["-NoProfile", "-Command", `Compress-Archive -Path dist\\* -DestinationPath '${dest}' -Force`],
  { stdio: "inherit" }
);

if (result.error || result.status !== 0) {
  console.error(
    `zip-build: archiving failed${result.error ? ` (${result.error.message})` : ` (exit ${result.status})`}.`
  );
  process.exit(result.status ?? 1);
}

console.log(`zip-build: archived dist -> ${dest}`);
