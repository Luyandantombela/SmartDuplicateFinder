/**
 * jaroWinkler.js
 * Implements the Jaro and Jaro-Winkler similarity algorithms.
 * Jaro-Winkler boosts strings that share a common prefix, making
 * it well-suited for name matching.
 */

"use strict";

/**
 * Computes the Jaro similarity between two strings.
 * @param {string} s1
 * @param {string} s2
 * @returns {number} Jaro similarity in [0, 1]
 */
export function jaro(s1, s2) {
  if (s1 === s2) return 1;
  const len1 = s1.length;
  const len2 = s2.length;
  if (len1 === 0 || len2 === 0) return 0;

  // Maximum distance within which a character match is possible
  const matchDist = Math.floor(Math.max(len1, len2) / 2) - 1;
  if (matchDist < 0) return 0;

  const s1Matches = new Array(len1).fill(false);
  const s2Matches = new Array(len2).fill(false);

  let matches = 0;
  let transpositions = 0;

  // Find matching characters
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDist);
    const end   = Math.min(i + matchDist + 1, len2);
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  // Count transpositions
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  return (
    (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3
  );
}

/**
 * Computes the Jaro-Winkler similarity.
 * Applies a prefix bonus (up to 4 characters) on top of Jaro similarity.
 * @param {string} s1
 * @param {string} s2
 * @param {number} [p=0.1] scaling factor (≤ 0.25)
 * @returns {number} Jaro-Winkler similarity in [0, 1]
 */
export function jaroWinkler(s1, s2, p = 0.1) {
  const jaroSim = jaro(s1, s2);

  // Common prefix length (up to 4 chars)
  let prefixLen = 0;
  const maxPrefix = Math.min(4, Math.min(s1.length, s2.length));
  while (prefixLen < maxPrefix && s1[prefixLen] === s2[prefixLen]) {
    prefixLen++;
  }

  return jaroSim + prefixLen * p * (1 - jaroSim);
}
