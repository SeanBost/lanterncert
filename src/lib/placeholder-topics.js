// PLACEHOLDER — delete in Sprint 3, when the taxonomy is locked. CLAUDE.md ▸ Open decisions.

export const placeholderTopics = [
  { slug: "licensing-and-the-law", name: "Licensing & the law" },
  { slug: "protective-gear", name: "Protective gear" },
  { slug: "basic-control", name: "Basic control" },
];

export function findTopic(slug) {
  return placeholderTopics.find((t) => t.slug === slug) ?? null;
}
