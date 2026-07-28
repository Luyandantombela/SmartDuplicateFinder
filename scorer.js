/**
 * scorer.js
 * Combines Levenshtein and Jaro-Winkler into a single weighted similarity
 * score and generates human-readable explanations for each match.
 */

"use strict";

import { levenshteinSimilarity } from "./levenshtein.js";
import { jaroWinkler } from "./jaroWinkler.js";
import { normalize } from "./normalize.js";

// Weight split between the two algorithms
const LEVENSHTEIN_WEIGHT = 0.45;
const JARO_WINKLER_WEIGHT = 0.55;

/**
 * Computes a combined similarity score between two raw values.
 *
 * @param {string} rawA  Original (un-normalized) value
 * @param {string} rawB  Original (un-normalized) value
 * @returns {{ score: number, normA: string, normB: string }}
 *   score is in [0, 1]; normA/normB are the normalized versions used
 */
export function combinedScore(rawA, rawB) {
  const normA = normalize(rawA);
  const normB = normalize(rawB);

  if (normA === normB) {
    return { score: 1, normA, normB };
  }
  if (!normA || !normB) {
    return { score: 0, normA, normB };
  }

  const lev = levenshteinSimilarity(normA, normB);
  const jw  = jaroWinkler(normA, normB);

  const score = LEVENSHTEIN_WEIGHT * lev + JARO_WINKLER_WEIGHT * jw;
  return { score, normA, normB };
}

/**
 * Returns a list of human-readable reason strings explaining why
 * two values were flagged as similar.
 *
 * @param {string} rawA
 * @param {string} rawB
 * @param {number} score  Combined score in [0,1]
 * @returns {string[]}
 */
export function explainMatch(rawA, rawB, score) {
  const reasons = [];
  const normA = normalize(rawA);
  const normB = normalize(rawB);

  // Exact after normalization
  if (normA === normB) {
    reasons.push("Identical after normalization");
    if (rawA.toLowerCase() !== rawB.toLowerCase()) {
      reasons.push("Same ignoring capitalization");
    }
    if (rawA.trim() !== rawA || rawB.trim() !== rawB) {
      reasons.push("Same after removing extra spaces");
    }
    return reasons;
  }

  // Case-only difference
  if (rawA.toLowerCase() === rawB.toLowerCase()) {
    reasons.push("Same ignoring capitalization");
    return reasons;
  }

  // Punctuation-only difference
  const stripped = (s) => s.replace(/[^a-z0-9 ]/gi, "").toLowerCase().replace(/\s+/g, " ").trim();
  if (stripped(rawA) === stripped(rawB)) {
    reasons.push("Same after removing punctuation");
  }

  // Very high overall score
  if (score >= 0.99) {
    reasons.push("Near-identical characters");
  } else if (score >= 0.95) {
    reasons.push("Very high character similarity");
  } else if (score >= 0.90) {
    reasons.push("High character similarity");
  } else if (score >= 0.80) {
    reasons.push("Moderate character similarity");
  }

  // Length difference
  const lenDiff = Math.abs(rawA.length - rawB.length);
  if (lenDiff <= 2 && lenDiff > 0) {
    reasons.push(`${lenDiff === 1 ? "One" : "Two"} character difference`);
  } else if (lenDiff <= 5 && lenDiff > 2) {
    reasons.push("Small length difference");
  }

  // Prefix match
  const minLen = Math.min(normA.length, normB.length);
  let prefixLen = 0;
  while (prefixLen < minLen && normA[prefixLen] === normB[prefixLen]) prefixLen++;
  if (prefixLen >= 3 && prefixLen / minLen >= 0.6) {
    reasons.push("Matching prefix");
  }

  // One contains the other
  if (normA.includes(normB) || normB.includes(normA)) {
    reasons.push("One value is contained within the other");
  }

  // & vs and
  const andA = rawA.toLowerCase().replace(/\s*&\s*/g, " and ");
  const andB = rawB.toLowerCase().replace(/\s*&\s*/g, " and ");
  if (andA.trim() === andB.trim()) {
    reasons.push("Difference is '&' vs 'and'");
  }

  // Abbreviation check: one is all uppercase and matches initials of other
  const wordsA = normA.split(" ");
  const wordsB = normB.split(" ");
  if (wordsA.length === 1 && wordsB.length > 1) {
    const initials = wordsB.map((w) => w[0]).join("");
    if (initials === normA) reasons.push("Possible abbreviation");
  } else if (wordsB.length === 1 && wordsA.length > 1) {
    const initials = wordsA.map((w) => w[0]).join("");
    if (initials === normB) reasons.push("Possible abbreviation");
  }

  // Common word overlap
  const setA = new Set(wordsA.filter((w) => w.length > 2));
  const setB = new Set(wordsB.filter((w) => w.length > 2));
  const shared = [...setA].filter((w) => setB.has(w));
  if (shared.length > 0 && reasons.length === 0) {
    reasons.push(`Shared word${shared.length > 1 ? "s" : ""}: "${shared.join('", "')}"`);
  }

  if (reasons.length === 0) {
    reasons.push("Fuzzy character pattern match");
  }

  return reasons;
}

/**
 * Returns confidence metadata from a raw score.
 * @param {number} score  0-1
 * @returns {{ pct: number, label: string, level: "green"|"yellow"|"orange"|"red" }}
 */
export function confidenceMeta(score) {
  const pct = Math.round(score * 100);
  if (pct >= 99) return { pct, label: "Almost Certain",   level: "green"  };
  if (pct >= 90) return { pct, label: "Likely Duplicate", level: "yellow" };
  if (pct >= 80) return { pct, label: "Review",           level: "orange" };
  return              { pct, label: "Probably Different", level: "red"    };
}
