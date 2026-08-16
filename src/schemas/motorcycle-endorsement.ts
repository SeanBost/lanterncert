// Everything specific to the motorcycle-endorsement cert: its vocabularies, its exam hierarchy and
// its three collections. Universal machinery is passed in from content.config.ts as `kit` rather
// than imported, which keeps this file free of a back-import and the config free of cert detail.
import { defineCollection, z } from "astro:content";
import { file } from "astro/loaders";

import registry from "../content/sources/motorcycle-endorsement-sources.json";
import exams from "../content/exams/motorcycle-endorsement-exams.json";

export const slug = "motorcycle-endorsement";

// The exams file is the authority on the examType vocabulary — a token exists iff it has an entry.
const examTypes = Object.keys(exams) as [string, ...string[]];

export function collections(kit: any) {
  const { makeSourceRef, makeFact, amount, year, scopeEnum, appliesToEnum } = kit;

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

  // A conformance edge is a factual claim about one curriculum meeting another's standard, so it
  // carries a citation like any other fact. Content inherits DOWNWARD: a question scoped to the
  // broader standard reaches every conformant exam, never the reverse.
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
          questionCount: fact(z.number().int().positive()),
          timeLimitMinutes: fact(z.number().int().positive()),
          passingScorePercent: fact(z.number().min(0).max(100)),
          isExamSectioned: fact(z.boolean()),
        }),
        criteria: z.strictObject({
          dmvCost: fact(amount),
          classCost: fact(amount),
          minAge: fact(z.number().int().positive()),
          minLicense: fact(z.enum(["None", "Learners", "Drivers"])),
          transferOutOfStateEndorsement: fact(z.enum(["all", "none", "non-Alabama"])),
          courseType: fact(z.enum(["MSFBRC", "MNS2011", "CA"])),
          findCourse: fact(z.enum(["stateLocator", "stateProgram"])),
          requirementType: fact(z.enum(["50ccUp", "all"])),
          expirationType: fact(z.enum(["never", "8year", "5year"])),
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
