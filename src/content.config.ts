// Universal schema machinery only; cert vocabulary lives in src/schemas/<cert>.ts.
import { reference, z } from "astro:content";
import states from "./content/states.json";
import * as motorcycleEndorsement from "./schemas/motorcycle-endorsement";

const stateCodes = Object.values(states).map((s) => s.abbreviation);

// Registry scope is any state in states.json, or `multi` for xx- keys. data-handling.md ▸ Sources §2.
const scopeEnum = z.enum(["multi", ...stateCodes] as [string, ...string[]]);

// applies_to takes a state code, ALL, or an exam token. data-handling.md ▸ Questions §3.
const appliesToEnum = (examTypes: string[]) =>
  z.enum([...new Set(["ALL", ...stateCodes, ...examTypes])] as [string, ...string[]]);

// Upper bound tracks the clock so a fat-fingered future year fails without an annual edit here.
const year = () => z.number().int().min(1900).max(new Date().getFullYear() + 1);

// A range is exactly two ascending numbers in one unit. data-handling.md ▸ Cert facts ▸ Contract.
const range = z
  .tuple([z.number(), z.number()])
  .refine(([lo, hi]) => lo < hi, { error: "a range must be [min, max], ascending" });

const amount = z.union([z.number().nonnegative(), range]);

// The refine is the enforcement; reference() alone lets a dangling key through silently.
// data-handling.md ▸ Questions §12.
const makeSourceRef = (registry: object, collection: any) => {
  const keys = new Set(Object.keys(registry));
  return () =>
    z
      .string()
      .refine((k) => keys.has(k), { error: `unknown source key — not in the ${collection} registry` })
      .pipe(reference(collection));
};

// A fact is verified iff it has a source, so a value without one fails. data-handling.md ▸ Contract.
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
