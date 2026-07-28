/**
 * progress.js
 * Manages the progress bar UI element.
 * Keeps the DOM update logic isolated from business logic.
 */

"use strict";

let _barEl   = null;  // <div class="progress-bar-fill">
let _textEl  = null;  // <span> showing "53%"
let _wrapEl  = null;  // wrapper shown/hidden
let _labelEl = null;  // "Scanning…" label

/**
 * Initialise by passing DOM element references.
 * Call once after the page loads.
 *
 * @param {{ wrap: HTMLElement, bar: HTMLElement, text: HTMLElement, label: HTMLElement }} els
 */
export function initProgress({ wrap, bar, text, label }) {
  _wrapEl  = wrap;
  _barEl   = bar;
  _textEl  = text;
  _labelEl = label;
}

/**
 * Show the progress bar with an optional status message.
 * @param {string} [message="Scanning…"]
 */
export function showProgress(message = "Scanning\u2026") {
  if (_labelEl) _labelEl.textContent = message;
  if (_wrapEl)  _wrapEl.style.display = "block";
  setProgress(0);
}

/**
 * Update the progress bar to a given percentage.
 * @param {number} pct  0-100
 */
export function setProgress(pct) {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  if (_barEl)  _barEl.style.width = `${clamped}%`;
  if (_textEl) _textEl.textContent = `${clamped}%`;
}

/**
 * Update just the label text without touching the percentage.
 * @param {string} message
 */
export function setProgressLabel(message) {
  if (_labelEl) _labelEl.textContent = message;
}

/**
 * Hide the progress bar.
 */
export function hideProgress() {
  if (_wrapEl) _wrapEl.style.display = "none";
  setProgress(0);
}
