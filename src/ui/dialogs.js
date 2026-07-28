/**
 * dialogs.js
 * Lightweight modal dialog and toast notification system.
 * Does not depend on any third-party library.
 */

"use strict";

import { escapeHtml } from "../utils/helpers.js";

// ─── Toast ────────────────────────────────────────────────────────────────────

let _toastContainer = null;

function getToastContainer() {
  if (!_toastContainer) {
    _toastContainer = document.createElement("div");
    _toastContainer.className = "toast-container";
    document.body.appendChild(_toastContainer);
  }
  return _toastContainer;
}

/**
 * Show a temporary toast notification.
 * @param {string} message
 * @param {"info"|"success"|"warning"|"error"} [type="info"]
 * @param {number} [duration=3500] Auto-dismiss after ms (0 = manual only)
 */
export function showToast(message, type = "info", duration = 3500) {
  const container = getToastContainer();

  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `
    <span class="toast__icon">${toastIcon(type)}</span>
    <span class="toast__msg">${escapeHtml(message)}</span>
    <button class="toast__close" aria-label="Dismiss">&#x2715;</button>
  `;

  const dismiss = () => {
    toast.classList.add("toast--hiding");
    toast.addEventListener("animationend", () => toast.remove(), { once: true });
  };

  toast.querySelector(".toast__close").addEventListener("click", dismiss);
  if (duration > 0) setTimeout(dismiss, duration);

  container.appendChild(toast);
}

function toastIcon(type) {
  const icons = {
    info:    "ℹ",
    success: "✓",
    warning: "⚠",
    error:   "✕",
  };
  return icons[type] || icons.info;
}

// ─── Confirm Dialog ──────────────────────────────────────────────────────────

/**
 * Show a modal confirmation dialog.
 * Returns a promise that resolves to true (confirmed) or false (cancelled).
 *
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} opts.message
 * @param {string} [opts.confirmText="Confirm"]
 * @param {string} [opts.cancelText="Cancel"]
 * @param {"primary"|"danger"} [opts.confirmStyle="primary"]
 * @returns {Promise<boolean>}
 */
export function showConfirm({
  title,
  message,
  confirmText = "Confirm",
  cancelText  = "Cancel",
  confirmStyle = "primary",
}) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "dialog-overlay";
    overlay.innerHTML = `
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="dlg-title">
        <h2 class="dialog__title" id="dlg-title">${escapeHtml(title)}</h2>
        <p  class="dialog__msg">${escapeHtml(message)}</p>
        <div class="dialog__actions">
          <button class="btn btn--ghost" data-action="cancel">${escapeHtml(cancelText)}</button>
          <button class="btn btn--${confirmStyle}" data-action="confirm">${escapeHtml(confirmText)}</button>
        </div>
      </div>
    `;

    const close = (result) => {
      overlay.remove();
      resolve(result);
    };

    overlay.querySelector("[data-action='cancel']").addEventListener("click",  () => close(false));
    overlay.querySelector("[data-action='confirm']").addEventListener("click", () => close(true));
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(false); });

    document.body.appendChild(overlay);
    // Focus confirm button for keyboard users
    overlay.querySelector("[data-action='confirm']").focus();
  });
}

// ─── Master-Value Picker ─────────────────────────────────────────────────────

/**
 * Shows a dialog that lets the user pick a master value from a list.
 * Returns a promise that resolves to the chosen value string, or null if cancelled.
 *
 * @param {string[]} values  The candidate values the user can choose from
 * @returns {Promise<string|null>}
 */
export function pickMasterValue(values) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "dialog-overlay";

    const optionsHtml = values
      .map(
        (v, i) =>
          `<label class="radio-option">
            <input type="radio" name="master-pick" value="${i}" ${i === 0 ? "checked" : ""}>
            <span class="radio-option__label">${escapeHtml(v)}</span>
          </label>`
      )
      .join("");

    overlay.innerHTML = `
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="dlg-pick-title">
        <h2 class="dialog__title" id="dlg-pick-title">Choose Master Value</h2>
        <p  class="dialog__msg">All duplicates in this group will be replaced with the value you choose.</p>
        <div class="radio-list">${optionsHtml}</div>
        <div class="dialog__actions">
          <button class="btn btn--ghost"    data-action="cancel">Cancel</button>
          <button class="btn btn--primary"  data-action="confirm">Apply Replacement</button>
        </div>
      </div>
    `;

    const close = (result) => {
      overlay.remove();
      resolve(result);
    };

    overlay.querySelector("[data-action='cancel']").addEventListener("click", () => close(null));
    overlay.querySelector("[data-action='confirm']").addEventListener("click", () => {
      const checked = overlay.querySelector("input[name='master-pick']:checked");
      if (checked) close(values[parseInt(checked.value, 10)]);
    });
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(null); });

    document.body.appendChild(overlay);
  });
}
