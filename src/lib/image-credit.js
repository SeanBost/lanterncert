// An image's credit is the folder it sits in. data-handling.md ▸ Questions §9d.

/** The folder for art LanternCert drew itself, which credits no document. */
export const ORIGINAL_ART = "lanterncert";

/**
 * The credit folder of a question image.
 * @param {string | undefined} src the image's `media.src`, or undefined for a text-only question
 * @returns {string | undefined} a registry key, ORIGINAL_ART, or undefined
 */
export function creditOf(src) {
  return src?.split("/").at(-2);
}
