/**
 * helpers.js
 * General-purpose utility functions shared across modules.
 */

"use strict";

/**
 * Groups an array of objects by a key-producing function.
 * @template T
 * @param {T[]} arr
 * @param {function(T): string} keyFn
 * @returns {Map<string, T[]>}
 */
export function groupBy(arr, keyFn) {
  const map = new Map();
  for (const item of arr) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

/**
 * Formats a duration in milliseconds into a human-readable string.
 * @param {number} ms
 * @returns {string}  e.g. "1.23 s" or "450 ms"
 */
export function formatDuration(ms) {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

/**
 * Escapes a string for safe insertion as HTML text content.
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Debounces a function: delays invocation until after `wait` ms of silence.
 * @param {function} fn
 * @param {number} wait  Milliseconds
 * @returns {function}
 */
export function debounce(fn, wait) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

/**
 * Yields to the browser event loop so the UI can repaint.
 * Useful inside long synchronous loops.
 * @returns {Promise<void>}
 */
export function yieldToUI() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Clamps a number between min and max (inclusive).
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Returns a deep copy of a plain object/array via JSON round-trip.
 * Do not use with functions, Dates, or circular refs.
 * @template T
 * @param {T} obj
 * @returns {T}
 */
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Generates a simple sequential ID string (not cryptographically secure).
 * @returns {string}
 */
let _idCounter = 0;
export function nextId() {
  return `sdf-${++_idCounter}`;
}
