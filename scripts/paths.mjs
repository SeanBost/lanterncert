// Every blackbox location the tooling reads or writes, imported anywhere in the repo as "#paths".
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const BLACKBOX = join(ROOT, "blackbox");

export const SOURCES = join(BLACKBOX, "sources");
export const SNAPSHOT_DIR = join(SOURCES, "snapshots");
export const SNAPSHOT_HISTORY_DIR = join(SOURCES, "snapshot-history");
export const PRIMARY_SOURCE_DIR = join(SOURCES, "documents");
export const REQUEST_GUARD = join(SOURCES, "request-guard.json");

export const AUTHORING = join(BLACKBOX, "authoring");
export const TECHNIQUE_DIR = join(AUTHORING, "technique");
export const QUESTION_ART = join(AUTHORING, "question-art");
export const exclusionsFile = (cert) => join(AUTHORING, `${cert}-exclusions.json`);

export const SESSIONS = join(BLACKBOX, "project", "sessions.md");
export const ARCHIVE = join(BLACKBOX, "zzz_old");
export const DOC_HISTORY = join(BLACKBOX, ".doc-history");
