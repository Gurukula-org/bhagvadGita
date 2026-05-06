/**
 * @typedef {{ one_line_meaning?: string }} VerseLike
 */

/**
 * Deterministic chapter description generator.
 * @param {VerseLike[]} verses
 * @returns {string}
 */
export function generateChapterDescription(verses) {
  if (!Array.isArray(verses) || verses.length === 0) return "";
  const meanings = verses
    .map((verse) => (verse?.one_line_meaning || "").trim())
    .filter(Boolean);
  if (meanings.length === 0) return "";
  if (meanings.length <= 4) return meanings.join(" ");
  const step = Math.floor(meanings.length / 4);
  return [meanings[0], meanings[step], meanings[step * 2], meanings[meanings.length - 1]].join(" ");
}

