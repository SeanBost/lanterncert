// The one place a registry entry becomes the line of text under its link.

/**
 * Joined rather than interpolated — both years are optional and often absent.
 * @param {{ publisher: string, published: number | null, verifiedCurrentIn: number | null }} source
 */
export function formatSourceMeta(source) {
  return [
    source.publisher,
    source.published ? `published ${source.published}` : null,
    source.verifiedCurrentIn ? `verified current in ${source.verifiedCurrentIn}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
