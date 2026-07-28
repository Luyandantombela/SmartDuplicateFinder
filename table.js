/**
 * table.js
 * Renders duplicate groups in the results panel.
 * Each group is a collapsible card showing members, confidence badge,
 * reasons, and Accept / Ignore action buttons.
 */

"use strict";

import { escapeHtml } from "../utils/helpers.js";
import { confidenceMeta } from "../fuzzy/scorer.js";

/**
 * Render all duplicate groups into a container element.
 *
 * @param {HTMLElement} container  The element to render into (cleared first)
 * @param {DuplicateGroup[]} groups  Array of group objects
 * @param {object} callbacks
 * @param {function(DuplicateGroup): void} callbacks.onAccept
 * @param {function(DuplicateGroup): void} callbacks.onIgnore
 *
 * @typedef {object} DuplicateGroup
 * @property {string}   id         Unique group id
 * @property {Member[]} members    Entries in the group
 * @property {number}   confidence 0-1 overall group confidence
 * @property {string[]} reasons    Explanation strings
 * @property {boolean}  [ignored]
 * @property {boolean}  [accepted]
 *
 * @typedef {object} Member
 * @property {string} raw      Original cell value
 * @property {number} rowIndex 0-based row index in the sheet
 */
export function renderGroups(container, groups, { onAccept, onIgnore }) {
  container.innerHTML = "";

  if (!groups || groups.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">🎉</div>
        <p class="empty-state__title">No duplicates found</p>
        <p class="empty-state__sub">Your data looks clean!</p>
      </div>`;
    return;
  }

  const frag = document.createDocumentFragment();

  groups.forEach((group, idx) => {
    if (group.ignored) return; // skip already-dismissed groups

    const meta   = confidenceMeta(group.confidence);
    const card   = document.createElement("div");
    card.className = `group-card group-card--${meta.level}${group.accepted ? " group-card--accepted" : ""}`;
    card.dataset.groupId = group.id;

    card.innerHTML = `
      <div class="group-card__header">
        <button class="group-card__toggle" aria-expanded="true" aria-controls="gc-body-${group.id}">
          <span class="group-card__caret">▼</span>
          <span class="group-card__title">Group ${idx + 1}</span>
          <span class="group-card__count">${group.members.length} entries</span>
        </button>
        <span class="confidence-badge confidence-badge--${meta.level}">
          ${meta.pct}% — ${escapeHtml(meta.label)}
        </span>
      </div>

      <div class="group-card__body" id="gc-body-${group.id}">
        <ul class="group-card__members">
          ${group.members.map(
            (m) => `<li class="group-card__member">
              <span class="group-card__member-row">Row ${m.rowIndex + 1}</span>
              <span class="group-card__member-val">${escapeHtml(m.raw)}</span>
            </li>`
          ).join("")}
        </ul>

        ${group.reasons.length ? `
        <div class="group-card__reasons">
          <p class="group-card__reasons-title">Why flagged:</p>
          <ul class="reasons-list">
            ${group.reasons.map((r) => `<li>✓ ${escapeHtml(r)}</li>`).join("")}
          </ul>
        </div>` : ""}

        ${group.accepted ? `
        <p class="group-card__accepted-note">✓ Replacement applied</p>
        ` : `
        <div class="group-card__actions">
          <button class="btn btn--primary btn--sm btn-accept" data-group-id="${group.id}">
            Accept &amp; Replace
          </button>
          <button class="btn btn--ghost btn--sm btn-ignore" data-group-id="${group.id}">
            Ignore
          </button>
        </div>`}
      </div>
    `;

    // Toggle collapse
    const toggleBtn = card.querySelector(".group-card__toggle");
    const body      = card.querySelector(`#gc-body-${group.id}`);
    const caret     = card.querySelector(".group-card__caret");
    toggleBtn.addEventListener("click", () => {
      const expanded = toggleBtn.getAttribute("aria-expanded") === "true";
      toggleBtn.setAttribute("aria-expanded", String(!expanded));
      body.style.display = expanded ? "none" : "";
      caret.textContent  = expanded ? "▶" : "▼";
    });

    // Action buttons
    const acceptBtn = card.querySelector(".btn-accept");
    const ignoreBtn = card.querySelector(".btn-ignore");
    if (acceptBtn) acceptBtn.addEventListener("click", () => onAccept(group));
    if (ignoreBtn) ignoreBtn.addEventListener("click", () => onIgnore(group));

    frag.appendChild(card);
  });

  container.appendChild(frag);
}

/**
 * Mark a group card as accepted (replaces action buttons with confirmation note).
 * @param {string} groupId
 */
export function markGroupAccepted(groupId) {
  const card = document.querySelector(`.group-card[data-group-id="${groupId}"]`);
  if (!card) return;
  card.classList.add("group-card--accepted");
  const actions = card.querySelector(".group-card__actions");
  if (actions) {
    actions.outerHTML = `<p class="group-card__accepted-note">✓ Replacement applied</p>`;
  }
}

/**
 * Remove a group card from the DOM (when user ignores it).
 * @param {string} groupId
 */
export function removeGroupCard(groupId) {
  const card = document.querySelector(`.group-card[data-group-id="${groupId}"]`);
  if (card) {
    card.classList.add("group-card--removing");
    card.addEventListener("animationend", () => card.remove(), { once: true });
  }
}

/**
 * Renders the scan statistics summary bar.
 *
 * @param {HTMLElement} el  The element to populate
 * @param {object} stats
 * @param {number} stats.rowsScanned
 * @param {number} stats.groupsFound
 * @param {number} stats.exactDuplicates
 * @param {number} stats.fuzzyDuplicates
 * @param {number} stats.avgConfidence  0-1
 * @param {number} stats.timeTaken      ms
 */
export function renderStats(el, stats) {
  const { rowsScanned, groupsFound, exactDuplicates, fuzzyDuplicates, avgConfidence, timeTaken } = stats;
  const avgPct = Math.round(avgConfidence * 100);
  const timeStr = timeTaken < 1000 ? `${Math.round(timeTaken)} ms` : `${(timeTaken / 1000).toFixed(2)} s`;

  el.innerHTML = `
    <div class="stats-grid">
      <div class="stat-item">
        <span class="stat-item__val">${rowsScanned.toLocaleString()}</span>
        <span class="stat-item__lbl">Rows scanned</span>
      </div>
      <div class="stat-item">
        <span class="stat-item__val">${groupsFound}</span>
        <span class="stat-item__lbl">Groups found</span>
      </div>
      <div class="stat-item">
        <span class="stat-item__val">${exactDuplicates}</span>
        <span class="stat-item__lbl">Exact duplicates</span>
      </div>
      <div class="stat-item">
        <span class="stat-item__val">${fuzzyDuplicates}</span>
        <span class="stat-item__lbl">Fuzzy duplicates</span>
      </div>
      <div class="stat-item">
        <span class="stat-item__val">${avgPct > 0 ? avgPct + "%" : "—"}</span>
        <span class="stat-item__lbl">Avg confidence</span>
      </div>
      <div class="stat-item">
        <span class="stat-item__val">${timeStr}</span>
        <span class="stat-item__lbl">Time taken</span>
      </div>
    </div>
  `;
  el.style.display = "block";
}
