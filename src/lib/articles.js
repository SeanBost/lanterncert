// Agrees "a" and "an" with the word each governs, for prose assembled from facts at build.
// Runs over composed markup, so the article pattern excludes the "a" that opens an <a> tag.

// A letter's spoken name decides an initialism's article: an FLHSMV, a GA DDS.
const VOWEL_LETTER_NAMES = new Set("AEFHILMNORSX");

// Words the two letter rules get wrong. True takes "an".
const IRREGULAR = new Map([
  ["utah", false],
  ["nhtsa", false],
  ["one", false],
  ["once", false],
  ["european", false],
  ["uniform", false],
  ["union", false],
  ["unique", false],
  ["unit", false],
  ["united", false],
  ["universal", false],
  ["university", false],
  ["useful", false],
  ["user", false],
  ["usual", false],
  ["utility", false],
  ["heir", true],
  ["honest", true],
  ["honor", true],
  ["honorable", true],
  ["hour", true],
]);

// An article, any markup between it and its word, then that word's letters alone.
const ARTICLE = /(^|[^<\w])(an?)((?:\s|<[^>]*>)+)([A-Za-z]+)/gi;

/** Whether a word takes "an". A hyphenated compound is judged on its first element. */
function takesAn(word) {
  const irregular = IRREGULAR.get(word.toLowerCase());
  if (irregular !== undefined) return irregular;
  // An all-caps run is read out letter by letter, so the first letter's NAME decides it.
  if (word.length > 1 && word === word.toUpperCase()) return VOWEL_LETTER_NAMES.has(word[0]);
  return "AEIOU".includes(word[0].toUpperCase());
}

/**
 * @param {string} html composed prose, markup included
 * @returns {string} the same prose with every article agreeing with the word it governs
 */
export function fixArticles(html) {
  return html.replace(ARTICLE, (_, before, article, gap, word) => {
    const fixed = takesAn(word) ? "an" : "a";
    return `${before}${article[0] === "A" ? `A${fixed.slice(1)}` : fixed}${gap}${word}`;
  });
}
