// Builds a state's Study Guide from the prose scaffolding plus the questions that resolve for it.
// data-handling.md ▸ Study Guide §4c.
import { questionsForState } from "./applies-to.js";

/** The fact as the guide states it; a question with no `text` of its own falls back to §5 rule 6b. */
function factText(question) {
  return question.guide.text ?? question.content.explanation;
}

/**
 * Topic sections in the order given, each group carrying only the facts this state resolves.
 * @param {object} args scaffold, questions (normalized entries), topicOrder, and the applies-to ctx.
 * @returns {Array} sections, groups and empty topics already dropped.
 */
export function guideForState(stateSlug, { scaffold, questions, topicOrder, ctx }) {
  const mine = questionsForState(questions, stateSlug, ctx).filter((q) => q.guide);

  return topicOrder
    .filter((topic) => scaffold[topic])
    .map((topic) => {
      const groups = scaffold[topic].groups
        .map((group) => ({
          ...group,
          facts: mine
            .filter((q) => q.topic === topic && q.guide.group === group.id)
            // A tied order is legal and falls back to authoring order.
            .sort(
              (a, b) =>
                a.guide.order - b.guide.order || Number(a.meta.idKey) - Number(b.meta.idKey),
            )
            .map((q) => ({
              id: q.id,
              kind: q.guide.kind,
              label: q.guide.label,
              text: factText(q),
              source: q.meta.source,
              sourceSection: q.meta.sourceSection,
              media: q.content.media,
            })),
        }))
        .filter((group) => group.facts.length);

      return { topic, opener: scaffold[topic].opener, groups };
    })
    .filter((section) => section.groups.length);
}
