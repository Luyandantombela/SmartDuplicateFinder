/**
 * normalize.js
 * String normalization pipeline used before fuzzy comparison.
 * All transformations are pure functions.
 */

"use strict";

/**
 * Full normalization pipeline.
 * Steps applied (in order):
 *   1. Convert to string
 *   2. Trim leading/trailing whitespace
 *   3. Lowercase
 *   4. Decompose accented characters → remove combining diacritics
 *   5. Normalize & → and
 *   6. Remove punctuation: . , ' " - _ / \ ( ) [ ] { } : ; ! ? @
 *   7. Collapse multiple spaces to one
 *   8. Final trim
 *
 * @param {*} value  Raw cell value (string, number, etc.)
 * @returns {string} Normalized string
 */
export function normalize(value) {
  if (value === null || value === undefined) return "";

  let s = String(value);

  // Trim
  s = s.trim();

  // Lowercase
  s = s.toLowerCase();

  // Decompose accents then strip combining characters
  // e.g. é → e, ñ → n
  s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Normalize & to "and"
  s = s.replace(/\s*&\s*/g, " and ");

  // Remove punctuation commonly used in names/company names
  s = s.replace(/[.,'''"""()\[\]{}\-_\/\\:;!?@#*+=%~`^<>|]/g, " ");

  // Collapse whitespace
  s = s.replace(/\s+/g, " ");

  // Final trim
  s = s.trim();

  return s;
}

/**
 * Returns a quick-hash key for blocking: first char + length bucket.
 * Strings with very different lengths or first characters can be
 * skipped without full comparison.
 *
 * @param {string} normalized  Already-normalized string
 * @returns {string} Block key, e.g. "j3" for "jon" (length bucket 3)
 */
export function blockKey(normalized) {
  if (!normalized) return "__empty";
  const firstChar = normalized[0];
  // Length bucket: floor to nearest 3 (0,3,6,9,…) to allow small length diffs
  const bucket = Math.floor(normalized.length / 3);
  return `${firstChar}${bucket}`;
}

/**
 * Returns multiple block keys for a string so it can appear in
 * neighbouring buckets (handles edge cases near bucket boundaries).
 *
 * @param {string} normalized
 * @returns {string[]}
 */
export function blockKeys(normalized) {
  if (!normalized) return ["__empty"];
  const firstChar = normalized[0];
  const bucket = Math.floor(normalized.length / 3);
  const keys = new Set([
    `${firstChar}${bucket}`,
    `${firstChar}${Math.max(0, bucket - 1)}`,
    `${firstChar}${bucket + 1}`,
  ]);
  return [...keys];
}
