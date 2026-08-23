// The one place a registry entry becomes the line of text under its link.

/**
 * Parts rather than one string, so the render layer can style the separators apart.
 * @param {{ publisher: string, published: number | null, verifiedCurrentIn: number | null }} source
 * @returns {string[]}
 */
export function sourceMetaParts(source) {
  return [
    source.publisher,
    source.published ? `published ${source.published}` : null,
    source.verifiedCurrentIn ? `verified current in ${source.verifiedCurrentIn}` : null,
  ].filter(Boolean);
}

/** The same line as one string, for anywhere that cannot style the separators. */
export function formatSourceMeta(source) {
  return sourceMetaParts(source).join(" | ");
}
