/**
 * levenshtein.js
 * Computes the Levenshtein edit distance between two strings.
 * Uses an optimised two-row DP matrix to keep memory O(min(m,n)).
 */

"use strict";

/**
 * Returns the Levenshtein distance between strings a and b.
 * @param {string} a
 * @param {string} b
 * @returns {number} integer edit distance
 */
export function levenshteinDistance(a, b) {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Ensure a is the shorter string to minimise memory
  if (a.length > b.length) { const tmp = a; a = b; b = tmp; }

  const lenA = a.length;
  const lenB = b.length;

  let prev = new Array(lenA + 1);
  let curr = new Array(lenA + 1);

  // Initialise first row
  for (let i = 0; i <= lenA; i++) prev[i] = i;

  for (let j = 1; j <= lenB; j++) {
    curr[0] = j;
    for (let i = 1; i <= lenA; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[i] = Math.min(
        prev[i] + 1,        // deletion
        curr[i - 1] + 1,    // insertion
        prev[i - 1] + cost  // substitution
      );
    }
    // Swap rows
    [prev, curr] = [curr, prev];
  }

  return prev[lenA];
}

/**
 * Converts a Levenshtein distance into a 0-1 similarity score.
 * Score = 1 − (distance / maxLen)
 * @param {string} a
 * @param {string} b
 * @returns {number} similarity in [0, 1]
 */
export function levenshteinSimilarity(a, b) {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(a, b) / maxLen;
}
