// Everything specific to the motorcycle-endorsement cert. `kit` is PASSED IN from content.config.ts;
// importing it back would catch the Zod consts in their TDZ.
import { existsSync } from "node:fs";
import { defineCollection, z } from "astro:content";
import { file } from "astro/loaders";

import registry from "../content/sources/motorcycle-endorsement-sources.json";
import exams from "../content/exams/motorcycle-endorsement-exams.json";
import display from "../content/display/motorcycle-endorsement-display.json";
import topics from "../content/topics/motorcycle-endorsement-topics.json";
import questionBank from "../content/questions/motorcycle-endorsement-questions.json";
import guideScaffold from "../content/guide/motorcycle-endorsement-guide.json";
import weights from "../content/weights/motorcycle-endorsement-weights.json";
import states from "../content/states.json";

export const slug = "motorcycle-endorsement";

// The exams file is the authority on the examType vocabulary — a token exists iff it has an entry.
const examTokens = Object.keys(exams) as [string, ...string[]];
// Uppercase names a real exam; lowercase is an editorial grouping and never an examType.
const examTypes = examTokens.filter((t) => t !== t.toLowerCase()) as [string, ...string[]];

// The topics file is the authority on the topic vocabulary - a topic exists iff it has an entry.
const topicSlugs = Object.keys(topics) as [string, ...string[]];
// Topic weights: baseline plus sparse per-state overrides. data-handling.md ▸ Questions §3b-i.
const topicWeights = weights as { baseline: Record<string, number>; states: Record<string, any> };
// A slug is a guide anchor AND a localStorage key; a num rides every question id. Permanent from launch.
const topicNums = new Map(Object.entries(topics).map(([s, t]: [string, any]) => [t.num, s]));
if (topicNums.size !== topicSlugs.length) {
  throw new Error(`${slug}-topics.json: two topics share a num`);
}
const catchAlls = topicSlugs.filter((s) => (topics as any)[s].catchAll);
if (catchAlls.length !== 1) {
  throw new Error(`${slug}-topics.json: need exactly one catchAll, found ${catchAlls.length}`);
}

// Every topic has a baseline; overrides name a real topic and state and carry a note.
const weightFail = (why: string) => {
  throw new Error(`${slug}-weights.json: ${why}`);
};
const isWeight = (w: unknown) => Number.isInteger(w) && (w as number) >= 0;
for (const topic of topicSlugs) {
  if (!(topic in topicWeights.baseline)) weightFail(`no baseline weight for topic "${topic}"`);
}
for (const [topic, w] of Object.entries(topicWeights.baseline)) {
  if (!topicSlugs.includes(topic)) weightFail(`baseline has "${topic}", which is not a topic`);
  if (!isWeight(w)) weightFail(`baseline "${topic}" must be a non-negative integer`);
}
for (const [state, overrides] of Object.entries(topicWeights.states ?? {})) {
  if (!(state in states)) weightFail(`"${state}" is not a state in states.json`);
  for (const [topic, o] of Object.entries(overrides as Record<string, any>)) {
    if (!topicSlugs.includes(topic)) weightFail(`${state} overrides "${topic}", which is not a topic`);
    if (!isWeight(o?.weight)) weightFail(`${state}.${topic}.weight must be a non-negative integer`);
    if (!o?.note?.trim()) weightFail(`${state}.${topic} needs a note explaining the override`);
  }
}

// The guide's prose scaffolding: topics, their groups, and nothing else. data-handling.md ▸ §4c.
const guideGroups: Record<string, Set<string>> = {};
for (const [topic, section] of Object.entries(guideScaffold) as [string, any][]) {
  if (topic === "_about") continue;
  const guideFail = (why: string) => {
    throw new Error(`${slug}-guide.json: "${topic}" ${why}`);
  };
  if (!topicSlugs.includes(topic)) guideFail("is not a topic in the topics file");
  if (!section?.opener?.trim()) guideFail("has no opener");
  if (!Array.isArray(section?.groups) || !section.groups.length) guideFail("has no groups");
  guideGroups[topic] = new Set();
  for (const group of section.groups) {
    if (!/^[a-z0-9-]+$/.test(group?.id ?? "")) guideFail(`has a group id that is not kebab-case`);
    if (guideGroups[topic].has(group.id)) guideFail(`repeats the group id "${group.id}"`);
    if (!group?.heading?.trim() || !group?.leadIn?.trim()) {
      guideFail(`group "${group.id}" needs both a heading and a leadIn`);
    }
    guideGroups[topic].add(group.id);
  }
}

// A question's id is its key, which the collection schema never receives. data-handling.md ▸ Questions §5.
const sitewideNums = new Set<string>();
for (const [id, q] of Object.entries(questionBank) as [string, any][]) {
  const fail = (why: string) => {
    throw new Error(`${slug}-questions.json: "${id}" ${why}`);
  };
  if (!/^[a-z]{2,4}-[a-z0-9-]+-\d+-\d+$/.test(id)) {
    fail("is not <slugShort>-<scope>-<topic number>-<sitewide number>, all lowercase");
  }
  // Read from the ends: a lowercase umbrella token carries hyphens of its own.
  const parts = id.split("-");
  const sitewideNum = parts.pop() as string;
  const topicNum = parts.pop();
  parts.shift();
  if (parts.join("-") !== String(q.meta?.applies_to).toLowerCase()) {
    fail(`has a scope segment that does not match applies_to "${q.meta?.applies_to}"`);
  }
  if (topicNum !== String((topics as any)[q.meta?.topic]?.num)) {
    fail(`has a topic segment that does not match topic "${q.meta?.topic}"`);
  }
  if (q.meta?.idKey !== sitewideNum) {
    fail(`carries idKey "${q.meta?.idKey}", which is not its trailing number`);
  }
  // Rejects a reused sitewide number, which is the only permanent part of an id.
  if (sitewideNums.has(sitewideNum)) fail(`reuses sitewide number ${sitewideNum}`);
  sitewideNums.add(sitewideNum);
  // Fails on a media src with no file behind it. data-handling.md ▸ Questions §9c.
  const src = q.content?.media?.src;
  if (src && !existsSync(new URL(`../../public${src}`, import.meta.url))) {
    fail(`points at a missing image, public${src}`);
  }
  // The folder names the crediting document, so a miscredited image cannot ship.
  if (src && src.split("/").at(-2) !== q.content?.media?.imageCredit) {
    fail(`sits in a folder that is not its imageCredit "${q.content?.media?.imageCredit}"`);
  }
  // Rejects a guide group the topic does not declare, which would render the fact nowhere.
  const group = q.guide?.group;
  if (group && !guideGroups[q.meta?.topic]?.has(group)) {
    fail(`joins guide group "${group}", which its topic does not declare`);
  }
}

// Every constrained vocabulary in one place: what Zod enforces, and what the display file must cover.
const vocab: Record<string, [string, ...string[]]> = {
  minLicense: ["None", "Learners", "Drivers"],
  transferOutOfStateEndorsement: ["all", "none", "non-Alabama"],
  courseType: ["MSFBRC", "MNS2011", "CA"],
  findCourse: ["stateLocator", "stateProgram"],
  ridingSkillsTest: ["course", "agencyWaivable", "agencyUnlessLicensed"],
  examAdministration: ["agency", "course"],
  requirementType: ["50ccUp", "all", "30mphUp"],
  examType: examTypes,
};

// Boolean facts are not enums, so Zod types them directly - but they still reach a reader as prose,
// so the display file has to cover both values. Kept out of `vocab`, which feeds z.enum().
const boolVocab: Record<string, [string, ...string[]]> = {
  isExamSectioned: ["true", "false"],
  courseRequired: ["true", "false"],
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

  // An uppercase token's coverage claim is a claim about the world, so it carries a citation.
  for (const [token, exam] of Object.entries(exams) as [string, any][]) {
    const grouping = token === token.toLowerCase();
    if (grouping && Object.values(states).some((s: any) => s.abbreviation === token.toUpperCase())) {
      throw new Error(`${slug}-exams.json: "${token}" collides with a state code`);
    }
    if (!grouping && (exam.covers ?? []).length > 0 && !exam.source) {
      throw new Error(`${slug}-exams.json: "${token}" claims coverage without a source`);
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

  // The subject axis. `num` rides every question id and the key is the guide anchor - fixed at launch.
  const topicsCollection = defineCollection({
    loader: file(`src/content/topics/${slug}-topics.json`),
    schema: z.strictObject({
      num: z.number().int().positive(),
      name: z.string().min(1),
      // Paired mark for the topic, always decorative: it may never enter an accessible name.
      emoji: z.string().min(1).max(8),
      description: z.string().min(1),
      catchAll: z.boolean(),
    }),
  });

  // What this token covers: exam tokens, state codes, or other umbrellas. data-handling.md ▸ Questions §3b.
  const examsCollection = defineCollection({
    loader: file(`src/content/exams/${slug}-exams.json`),
    schema: z
      .strictObject({
        covers: z
          .array(
            z.string().refine((t) => t in exams || stateCodes.has(t), {
              error: "covers takes an exam token or a state code, and this is neither",
            }),
          )
          .default([]),
        source: sourceRef().nullable(),
      }),
  });

  const facts = defineCollection({
    loader: file(`src/content/facts/${slug}-facts.json`),
    schema: z
      .strictObject({
        // Whether a reader may be LINKED to this state; a held state still builds at its real URL.
        displayOnSite: z.boolean(),
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
          // Who runs the exam; a SOURCED null means the state has none. data-handling.md ▸ Cert facts.
          examAdministration: fact(z.enum(vocab.examAdministration)),
          // Whether the course waives the agency exam; asked only where examAdministration is
          // `agency`, and a sourced null elsewhere means the course IS the exam.
          courseWaivesAgencyExam: fact(z.boolean()),
          questionCount: fact(z.number().int().positive()),
          timeLimitMinutes: fact(z.number().int().positive()),
          passingScorePercent: fact(z.number().min(0).max(100)),
          isExamSectioned: fact(z.boolean()),
          // What the sections are CALLED, for copy. isExamSectioned stays the machine-readable
          // flag: null here must never be read as "not sectioned". data-handling.md ▸ Cert facts.
          examSectionNames: fact(z.string().min(1)),
          // A resource fact - the source is the test itself, valued as its display title.
          // data-handling.md ▸ Cert facts ▸ Resource facts.
          practiceExam: fact(z.string().min(1)),
        }),
        criteria: z.strictObject({
          dmvCost: fact(amount),
          classCost: fact(amount),
          minAge: fact(z.number().int().positive()),
          minLicense: fact(z.enum(vocab.minLicense)),
          transferOutOfStateEndorsement: fact(z.enum(vocab.transferOutOfStateEndorsement)),
          // Whether training is required of anyone at all. The one field that owns that claim.
          courseRequired: fact(z.boolean()),
          // The age below which courseRequired applies; null means the answer is not narrowed.
          courseRequiredUnderAge: fact(z.number().int().positive()),
          courseType: fact(z.enum(vocab.courseType)),
          findCourse: fact(z.enum(vocab.findCourse)),
          // Who administers the riding test, and whether the required course waives it.
          ridingSkillsTest: fact(z.enum(vocab.ridingSkillsTest)),
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

  // Keyed by id, so `meta` carries the record and `content` carries what a rider sees.
  const questionsCollection = defineCollection({
    loader: file(`src/content/questions/${slug}-questions.json`),
    schema: z
      .strictObject({
        meta: z.strictObject({
          // The id's permanent trailing number as a field, so a reference need not parse the id.
          idKey: z.string().regex(/^\d+$/, { error: "idKey is the id's trailing number, digits only" }),
          // Exactly one token: a set that needs naming is an umbrella, never an ad-hoc union.
          applies_to: appliesToEnum(examTokens),
          variantGroup: z
            .string()
            .regex(/^[a-z]{2,4}-[a-z0-9-]+$/, { error: "variantGroup is <slugShort>-<kebab-case name>" })
            .nullable(),
          topic: z.enum(topicSlugs),
          source: sourceRef(),
          // Caption under a citation naming where to look. data-handling.md ▸ Questions §1b.
          sourceSection: z
            .string()
            .min(1)
            .max(90, { error: "sourceSection is over 90 characters - it captions, it does not explain" })
            .nullable(),
          note: z.string().nullable(),
          dateCreated: z.iso.date(),
          // Null until the question is first edited; the date the wording last moved.
          lastEdited: z.iso.date().nullable(),
          // The date the source was last read back and still said this.
          lastVerified: z.iso.date(),
        }),
        content: z.strictObject({
          question: z.string().min(1),
          media: z
            .strictObject({
              type: z.enum(["image"]),
              src: z.string().min(1),
              // Describes the image and never its meaning. data-handling.md ▸ Questions §9b.
              alt: z.string().min(1),
              // Whether the question can be answered without seeing the image.
              neededForQ: z.boolean(),
              imageCredit: sourceRef(),
            })
            .nullable(),
          choices: z
            .array(z.strictObject({ id: z.string().min(1), text: z.string().min(1) }))
            .min(2),
          // A stable key, never a display letter: answer order is shuffled at render.
          correctAnswer: z.string().min(1),
          explanation: z.string().min(1),
        }),
        // What this question contributes to the Study Guide; null keeps it out. §4c.
        guide: z
          .strictObject({
            group: z.string().min(1),
            // Sparse, so a fact can be inserted between two others without renumbering.
            order: z.number().int().positive(),
            kind: z.enum(["rule", "value", "steps"]),
            label: z.string().min(1).nullable().default(null),
            // Null falls back to the explanation, which §5 rule 6b makes the same assertion.
            text: z.string().min(1).nullable().default(null),
          })
          .nullable(),
      })
      .superRefine((q: any, ctx: any) => {
        const ids = q.content.choices.map((c: any) => c.id);
        if (new Set(ids).size !== ids.length) {
          ctx.addIssue({ code: "custom", path: ["content", "choices"], message: "duplicate choice id" });
        }
        if (!ids.includes(q.content.correctAnswer)) {
          ctx.addIssue({
            code: "custom",
            path: ["content", "correctAnswer"],
            message: `correctAnswer "${q.content.correctAnswer}" matches no choice id (${ids.join(", ")})`,
          });
        }
        if (q.guide?.kind === "value" && !q.guide.label) {
          ctx.addIssue({
            code: "custom",
            path: ["guide", "label"],
            message: "a value renders as a label and a value, so it needs a label",
          });
        }
        for (const field of ["lastEdited", "lastVerified"]) {
          if (q.meta[field] && q.meta[field] < q.meta.dateCreated) {
            ctx.addIssue({
              code: "custom",
              path: ["meta", field],
              message: `${field} is earlier than dateCreated`,
            });
          }
        }
      }),
  });

  return {
    [`${slug}-sources`]: sources,
    [`${slug}-topics`]: topicsCollection,
    [`${slug}-exams`]: examsCollection,
    [`${slug}-facts`]: facts,
    [`${slug}-questions`]: questionsCollection,
  };
}
