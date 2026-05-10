/**
 * Split Devanagari/IAST stored as a multi-line string. Google Docs often emits
 * Unicode LINE SEPARATOR (U+2028) instead of LF — normalize here so chapter and
 * verse pages match Chapter 12-style line breaks.
 */
export function splitVerseLines(text: string): string[] {
  return text.split(/\r\n|\r|\n|\u0085|\u2028|\u2029/g);
}

/**
 * Removes trailing verse labels from IAST lines (e.g. ॥12.1॥) while keeping
 * the ॥ that precedes the verse number per editorial convention.
 */
export function stripTransliterationVerseSuffix(line: string): string {
  let s = line.trimEnd();
  s = s.replace(/\d+\.\d+॥\s*$/, "");
  s = s.replace(/\s+\d+\.\d+\s*॥\s*$/, "");
  return s;
}
