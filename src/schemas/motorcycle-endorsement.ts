// Everything specific to the motorcycle-endorsement cert. `kit` is PASSED IN from content.config.ts;
// importing it back would catch the Zod consts in their TDZ. CLAUDE.md ▸ Current state.
import { defineCollection, z } from "astro:content";
import { file } from "astro/loaders";

import registry from "../content/sources/motorcycle-endorsement-sources.json";
import exams from "../content/exams/motorcycle-endorsement-exams.json";
import display from "../content/display/motorcycle-endorsement-display.json";
import states from "../content/states.json";

export const slug = "motorcycle-endorsement";

// The exams file is the authority on the examType vocabulary — a token exists iff it has an entry.
const examTypes = Object.keys(exams) as [string, ...string[]];

// Every constrained vocabulary in one place: what Zod enforces, and what the display file must cover.
const vocab: Record<string, [string, ...string[]]> = {
  minLicense: ["None", "Learners", "Drivers"],
  transferOutOfStateEndorsement: ["all", "none", "non-Alabama"],
  courseType: ["MSFBRC", "MNS2011", "CA"],
  findCourse: ["stateLocator", "stateProgram"],
  requirementType: ["50ccUp", "all"],
  examType: examTypes,
};

// Boolean facts are not enums, so Zod types them directly - but they still reach a reader as prose,
// so the display file has to cover both values. Kept out of `vocab`, which feeds z.enum().
const boolVocab: Record<string, [string, ...string[]]> = {
  isExamSectioned: ["true", "false"],
};

export function collections(kit: any) {
  const { makeSourceRef, makeFact, amount, year, scopeEnum, appliesToEnum } = kit;

  // A token with no display string renders raw to a reader, so it fails the build instead.
  // data-handling.md ▸ Cert facts ▸ Display.
  const form = z.strictObject({ short: z.string().min(1), long: z.string().min(1) });
  const displayMap = z
    .record(
      z.string(),
      z.record(z.string(), z.union([form, z.strictObject({ named: form, unnamed: form })])),
    )
    .parse(display);
  // A state-code token is satisfied by the field's _stateSpecific pattern, since its display string
  // is built from the state's own facts rather than written out. data-handling.md ▸ Display §5.
  const stateCodes = new Set(Object.values(states).map((s: any) => s.abbreviation));
  for (const [field, tokens] of Object.entries({ ...vocab, ...boolVocab })) {
    for (const token of tokens) {
      if (displayMap[field]?.[token]) continue;
      if (stateCodes.has(token) && displayMap[field]?._stateSpecific) continue;
      throw new Error(`${slug}-display.json: no entry for ${field}.${token}`);
    }
  }

  const sourceRef = makeSourceRef(registry, `${slug}-sources`);
  const fact = makeFact(sourceRef);

  const sources = defineCollection({
    loader: file(`src/content/sources/${slug}-sources.json`),
    schema: z
      .strictObject({
        state: scopeEnum,
        sourceID: z
          .string()
          .regex(/^\d{4}$/, { error: "sourceID must be a zero-padded four-digit string" }),
        title: z.string().min(1),
        // Renders inline under the link on state pages. data-handling.md ▸ Sources — registry.
        description: z
          .string()
          .min(50, { error: "description is under 50 characters" })
          .max(90, { error: "description is over 90 characters" }),
        publisher: z.string().min(1),
        url: z.url(),
        access: z.enum(["public", "purchase", "restricted"]),
        published: year().nullable(),
        verifiedCurrentIn: year().nullable(),
      })
      .refine(
        (s) =>
          s.published === null ||
          s.verifiedCurrentIn === null ||
          s.published <= s.verifiedCurrentIn,
        { error: "verifiedCurrentIn is earlier than published" },
      ),
  });

  // A conformance edge is a factual claim, so it carries a citation like any other fact.
  const examsCollection = defineCollection({
    loader: file(`src/content/exams/${slug}-exams.json`),
    schema: z
      .strictObject({
        conformsTo: z.array(
          z.string().refine((t) => t in exams, { error: "unknown exam token" }),
        ),
        source: sourceRef().nullable(),
      })
      .refine((e) => e.conformsTo.length === 0 || e.source !== null, {
        error: "a conformsTo claim needs a source",
      }),
  });

  const facts = defineCollection({
    loader: file(`src/content/facts/${slug}-facts.json`),
    schema: z
      .strictObject({
        meta: z.strictObject({
          dateVerified: z.iso.date(),
          agencyCode: z.string().min(1),
          agencyName: z.string().min(1),
          localTerm: z.string().min(1),
          note: z.string().nullable(),
          stateDetails: z.string().nullable(),
        }),
        exam: z.strictObject({
          examType: fact(z.enum(examTypes)),
          // What the agency calls its exam. Null where the documents only describe it generically.
          examName: fact(z.string().min(1)),
          questionCount: fact(z.number().int().positive()),
          timeLimitMinutes: fact(z.number().int().positive()),
          passingScorePercent: fact(z.number().min(0).max(100)),
          isExamSectioned: fact(z.boolean()),
          // What the sections are CALLED, for copy. isExamSectioned stays the machine-readable
          // flag: null here must never be read as "not sectioned". data-handling.md ▸ Cert facts.
          examSectionNames: fact(z.string().min(1)),
        }),
        criteria: z.strictObject({
          dmvCost: fact(amount),
          classCost: fact(amount),
          minAge: fact(z.number().int().positive()),
          minLicense: fact(z.enum(vocab.minLicense)),
          transferOutOfStateEndorsement: fact(z.enum(vocab.transferOutOfStateEndorsement)),
          courseType: fact(z.enum(vocab.courseType)),
          findCourse: fact(z.enum(vocab.findCourse)),
          requirementType: fact(z.enum(vocab.requirementType)),
          // Years until renewal. 0 is "does not expire"; null is "not researched".
          renewalYears: fact(z.number().int().nonnegative()),
        }),
        additionalResources: z.array(sourceRef()),
      })
      // The two lists render separately, so a key in both shows up twice on the page.
      .superRefine((s: any, ctx: any) => {
        const cited = new Set(
          [...Object.values(s.exam), ...Object.values(s.criteria)]
            .map((f: any) => f.source?.id)
            .filter(Boolean),
        );
        for (const r of s.additionalResources) {
          if (cited.has(r.id)) {
            ctx.addIssue({
              code: "custom",
              path: ["additionalResources"],
              message: `${r.id} is already cited as a fact source in this state`,
            });
          }
        }
      }),
  });

  const questions = defineCollection({
    loader: file(`src/content/questions/${slug}-questions.json`),
    schema: z
      .strictObject({
        id: z.string().min(1),
        applies_to: z.array(appliesToEnum(examTypes)).min(1),
        // Free string until the taxonomy is locked against real questions. Sprint 3.
        topic: z.string().min(1),
        question: z.string().min(1),
        media: z
          .strictObject({
            type: z.enum(["image"]),
            src: z.string().min(1),
            alt: z.string().min(1),
            credit: sourceRef(),
          })
          .nullable(),
        choices: z
          .array(z.strictObject({ id: z.string().min(1), text: z.string().min(1) }))
          .min(2),
        correct: z.string().min(1),
        explanation: z.string().min(1),
        source: sourceRef(),
        last_reviewed: z.iso.date(),
      })
      .superRefine((q: any, ctx: any) => {
        const ids = q.choices.map((c: any) => c.id);
        if (new Set(ids).size !== ids.length) {
          ctx.addIssue({ code: "custom", path: ["choices"], message: "duplicate choice id" });
        }
        if (!ids.includes(q.correct)) {
          ctx.addIssue({
            code: "custom",
            path: ["correct"],
            message: `correct "${q.correct}" matches no choice id (${ids.join(", ")})`,
          });
        }
      }),
  });

  return {
    [`${slug}-sources`]: sources,
    [`${slug}-exams`]: examsCollection,
    [`${slug}-facts`]: facts,
    [`${slug}-questions`]: questions,
  };
}
