// Builds a state's Study Guide from the prose scaffolding plus the questions that resolve for it.
// data-handling.md ▸ Study Guide §4c.
import { questionsForState } from "./applies-to.js";

/** The fact as the guide states it; a question with no `text` of its own falls back to §5 rule 6b. */
function factText(question) {
  return question.guide.text ?? question.content.explanation;
}

/** The rendering shape of one guide fact, sorted; a tied order falls back to authoring order. */
function factsFrom(questions) {
  return questions
    .sort((a, b) => a.guide.order - b.guide.order || Number(a.meta.idKey) - Number(b.meta.idKey))
    .map((q) => ({
      id: q.id,
      kind: q.guide.kind,
      label: q.guide.label,
      text: factText(q),
      source: q.meta.source,
      sourceSection: q.meta.sourceSection,
      media: q.content.media,
    }));
}

/**
 * Topic sections in the order given, each group carrying only the facts this state resolves.
 * @param {object} args scaffold, questions (normalized entries), topicOrder, and the applies-to ctx.
 * @returns {Array} sections, with `ungrouped` ahead of `groups`; empty groups and topics dropped.
 */
export function guideForState(stateSlug, { scaffold, questions, topicOrder, ctx }) {
  const mine = questionsForState(questions, stateSlug, ctx).filter((q) => q.guide);

  return topicOrder
    .filter((topic) => scaffold[topic])
    .map((topic) => {
      const here = mine.filter((q) => q.topic === topic);
      const groups = scaffold[topic].groups
        .map((group) => ({ ...group, facts: factsFrom(here.filter((q) => q.guide.group === group.id)) }))
        .filter((group) => group.facts.length);

      return {
        topic,
        opener: scaffold[topic].opener,
        // Ungrouped facts sit above the first heading until a grouping pass places them. §4c rule 3.
        ungrouped: factsFrom(here.filter((q) => !q.guide.group)),
        groups,
      };
    })
    .filter((section) => section.ungrouped.length || section.groups.length);
}
