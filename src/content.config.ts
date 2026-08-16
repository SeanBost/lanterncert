// Universal schema machinery plus the collection registry. Everything cert-specific lives in
// src/schemas/<cert>.ts — adding a cert is one import and one spread.
import { reference, z } from "astro:content";
import states from "./content/states.json";
import * as motorcycleEndorsement from "./schemas/motorcycle-endorsement";

const stateCodes = Object.values(states).map((s) => s.abbreviation);

// Registry scope is any state in states.json, or `multi` for xx- keys. data-handling.md ▸ Sources §2.
const scopeEnum = z.enum(["multi", ...stateCodes] as [string, ...string[]]);

// applies_to takes a state code, ALL, or an exam token. One token space, and the overlap is harmless
// because a single-state exam takes that state's own code. data-handling.md ▸ Questions §3.
const appliesToEnum = (examTypes: string[]) =>
  z.enum([...new Set(["ALL", ...stateCodes, ...examTypes])] as [string, ...string[]]);

// Upper bound tracks the clock so a fat-fingered future year fails without an annual edit here.
const year = () => z.number().int().min(1900).max(new Date().getFullYear() + 1);

// A range is exactly two ascending numbers in one unit. data-handling.md ▸ Cert facts ▸ Contract.
const range = z
  .tuple([z.number(), z.number()])
  .refine(([lo, hi]) => lo < hi, { error: "a range must be [min, max], ascending" });

const amount = z.union([z.number().nonnegative(), range]);

// A bare reference() does NOT fail the build on a dangling key — it resolves to undefined silently
// at render. The refine is the enforcement; the pipe only buys getEntry() ergonomics.
// data-handling.md ▸ Questions §12.
const makeSourceRef = (registry: object, collection: any) => {
  const keys = new Set(Object.keys(registry));
  return () =>
    z
      .string()
      .refine((k) => keys.has(k), { error: `unknown source key — not in the ${collection} registry` })
      .pipe(reference(collection));
};

// A fact is verified iff it has a source: source null = unresearched, source set with value null =
// checked and no single honest answer. A value without a source is neither, so it fails.
const makeFact =
  (sourceRef: () => any) =>
  (value: any) =>
    z
      .strictObject({ value: value.nullable(), source: sourceRef().nullable() })
      .refine((f) => f.value === null || f.source !== null, {
        error: "a value with no source is unverified — leave both null until researched",
      });

const kit = { makeSourceRef, makeFact, amount, year, scopeEnum, appliesToEnum };

export const collections = {
  ...motorcycleEndorsement.collections(kit),
};
