/**
 * taskpane.js
 * Main controller for the Smart Duplicate Finder task pane.
 * Orchestrates scanning, grouping, UI rendering, replacements, and undo.
 */

"use strict";

import { readSelectedColumn, applyReplacements, isSheetProtected } from "./office.js";
import { normalize, blockKeys }                                      from "./fuzzy/normalize.js";
import { combinedScore, explainMatch, confidenceMeta }               from "./fuzzy/scorer.js";
import { showProgress, setProgress, setProgressLabel, hideProgress } from "./ui/progress.js";
import { renderGroups, markGroupAccepted, removeGroupCard, renderStats } from "./ui/table.js";
import { showToast, showConfirm, pickMasterValue }                   from "./ui/dialogs.js";
import { nextId, yieldToUI, deepClone }                              from "./utils/helpers.js";

// ─── Constants ─────────────────────────────────────────────────────────────

const MIN_SCORE   = 0.80;   // Pairs below this threshold are not grouped
const CHUNK_SIZE  = 200;    // Rows processed per async chunk (keeps UI responsive)

// ─── State ─────────────────────────────────────────────────────────────────

let _groups       = [];   // Current duplicate groups
let _undoStack    = [];   // Undo history [{rowIndex, oldValue, newValue}]

// ─── Office initialization ─────────────────────────────────────────────────

Office.onReady(({ host }) => {
  if (host === Office.HostType.Excel) {
    initUI();
  }
});

// ─── UI setup ──────────────────────────────────────────────────────────────

function initUI() {
  const scanBtn   = document.getElementById("btn-scan");
  const undoBtn   = document.getElementById("btn-undo");
  const thresholdSlider = document.getElementById("threshold-slider");
  const thresholdLabel  = document.getElementById("threshold-label");

  // Threshold slider
  thresholdSlider.addEventListener("input", () => {
    thresholdLabel.textContent = `${thresholdSlider.value}%`;
  });

  // Scan button
  scanBtn.addEventListener("click", runScan);

  // Undo button
  undoBtn.addEventListener("click", runUndo);

  // Note: progress bar is initialized via the inline module script in taskpane.html
}

// ─── Scan ───────────────────────────────────────────────────────────────────

async function runScan() {
  const scanBtn         = document.getElementById("btn-scan");
  const resultsPanel    = document.getElementById("results-panel");
  const statsPanel      = document.getElementById("stats-panel");
  const thresholdSlider = document.getElementById("threshold-slider");

  const threshold = parseInt(thresholdSlider.value, 10) / 100;

  scanBtn.disabled = true;
  statsPanel.style.display = "none";
  resultsPanel.innerHTML   = "";
  _groups = [];

  const t0 = performance.now();

  try {
    // Validate sheet protection
    const protected_ = await isSheetProtected();
    if (protected_) {
      showToast("This worksheet is protected. Unprotect it before scanning.", "error");
      return;
    }

    showProgress("Reading column\u2026");

    // Read data
    let entries;
    try {
      entries = await readSelectedColumn();
    } catch (err) {
      hideProgress();
      showToast(err.message, "error");
      return;
    }

    setProgress(5);
    setProgressLabel("Normalizing\u2026");
    await yieldToUI();

    // Normalize all values
    const normalized = entries.map((e) => ({
      ...e,
      norm: normalize(e.raw),
    }));

    setProgress(10);
    setProgressLabel("Building blocks\u2026");
    await yieldToUI();

    // Build block buckets for performance (avoid O(n²) brute force)
    const blocks = new Map();
    for (const item of normalized) {
      for (const key of blockKeys(item.norm)) {
        if (!blocks.has(key)) blocks.set(key, []);
        blocks.get(key).push(item);
      }
    }

    // Find pairs above threshold
    setProgressLabel("Comparing values\u2026");
    const pairScores = new Map();  // key = "i:j" → score
    const totalItems = normalized.length;
    let compared = 0;

    for (const bucket of blocks.values()) {
      for (let i = 0; i < bucket.length; i++) {
        for (let j = i + 1; j < bucket.length; j++) {
          const a = bucket[i];
          const b = bucket[j];

          // Skip if same row
          if (a.rowIndex === b.rowIndex) continue;

          // Canonical pair key (smaller rowIndex first)
          const pk = a.rowIndex < b.rowIndex
            ? `${a.rowIndex}:${b.rowIndex}`
            : `${b.rowIndex}:${a.rowIndex}`;
          if (pairScores.has(pk)) continue;

          // Quick length filter (values > 50% longer than other unlikely to match)
          const lenA = a.norm.length || 1;
          const lenB = b.norm.length || 1;
          if (Math.max(lenA, lenB) / Math.min(lenA, lenB) > 2.5) {
            pairScores.set(pk, 0);
            continue;
          }

          const { score } = combinedScore(a.raw, b.raw);
          pairScores.set(pk, score);
        }

        compared++;
        if (compared % CHUNK_SIZE === 0) {
          setProgress(10 + Math.round((compared / totalItems) * 60));
          await yieldToUI();
        }
      }
    }

    setProgress(72);
    setProgressLabel("Grouping duplicates\u2026");
    await yieldToUI();

    // Union-Find to cluster items into groups
    const parent = new Map(normalized.map((item) => [item.rowIndex, item.rowIndex]));
    const groupScore = new Map(); // canonical pair key → max score in group

    function find(x) {
      if (parent.get(x) !== x) parent.set(x, find(parent.get(x)));
      return parent.get(x);
    }
    function union(x, y) {
      const rx = find(x);
      const ry = find(y);
      if (rx !== ry) parent.set(rx, ry);
    }

    for (const [pk, score] of pairScores) {
      if (score >= threshold) {
        const [ri, rj] = pk.split(":").map(Number);
        union(ri, rj);
      }
    }

    // Collect into groups (only groups with >1 member are duplicates)
    const clusterMap = new Map();
    for (const item of normalized) {
      const root = find(item.rowIndex);
      if (!clusterMap.has(root)) clusterMap.set(root, []);
      clusterMap.get(root).push(item);
    }

    setProgress(85);
    setProgressLabel("Building results\u2026");
    await yieldToUI();

    let exactCount = 0;
    let fuzzyCount = 0;
    let totalConf  = 0;

    for (const members of clusterMap.values()) {
      if (members.length < 2) continue;

      // Compute group confidence: max pairwise score within group
      let maxScore = 0;
      const allReasons = new Set();

      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          const a = members[i];
          const b = members[j];
          const pk = a.rowIndex < b.rowIndex
            ? `${a.rowIndex}:${b.rowIndex}`
            : `${b.rowIndex}:${a.rowIndex}`;
          const score = pairScores.get(pk) ?? combinedScore(a.raw, b.raw).score;
          if (score > maxScore) maxScore = score;
          explainMatch(a.raw, b.raw, score).forEach((r) => allReasons.add(r));
        }
      }

      const isExact = members.every((m) => m.norm === members[0].norm);
      if (isExact) exactCount++;
      else          fuzzyCount++;

      totalConf += maxScore;

      _groups.push({
        id:         nextId(),
        members:    members.map((m) => ({ raw: m.raw, rowIndex: m.rowIndex })),
        confidence: maxScore,
        reasons:    [...allReasons].slice(0, 5),
        ignored:    false,
        accepted:   false,
      });
    }

    // Sort by confidence desc
    _groups.sort((a, b) => b.confidence - a.confidence);

    const t1    = performance.now();
    const stats = {
      rowsScanned:     entries.length,
      groupsFound:     _groups.length,
      exactDuplicates: exactCount,
      fuzzyDuplicates: fuzzyCount,
      avgConfidence:   _groups.length > 0 ? totalConf / _groups.length : 0,
      timeTaken:       t1 - t0,
    };

    setProgress(100);
    await yieldToUI();
    hideProgress();

    // Render
    renderStats(statsPanel, stats);
    renderGroups(resultsPanel, _groups, {
      onAccept: handleAccept,
      onIgnore: handleIgnore,
    });

    document.getElementById("btn-undo").style.display = "none";
    document.getElementById("results-section").style.display = "block";

    if (_groups.length === 0) {
      showToast("No duplicates found above the threshold.", "success");
    } else {
      showToast(`Found ${_groups.length} duplicate group${_groups.length > 1 ? "s" : ""}.`, "info");
    }

  } catch (err) {
    hideProgress();
    showToast("Unexpected error: " + (err.message || err), "error");
    console.error(err);
  } finally {
    scanBtn.disabled = false;
  }
}

// ─── Accept / Replace ────────────────────────────────────────────────────────

async function handleAccept(group) {
  const values = [...new Set(group.members.map((m) => m.raw))];

  const master = await pickMasterValue(values);
  if (master === null) return;  // user cancelled

  // Build replacements (all non-master members)
  const replacements = group.members
    .filter((m) => m.raw !== master)
    .map((m) => ({ rowIndex: m.rowIndex, newValue: master }));

  if (replacements.length === 0) {
    showToast("All entries already have the master value.", "info");
    markGroupAccepted(group.id);
    group.accepted = true;
    return;
  }

  // Push to undo stack
  _undoStack.push({
    groupId: group.id,
    changes: replacements.map((r) => ({
      rowIndex: r.rowIndex,
      oldValue: group.members.find((m) => m.rowIndex === r.rowIndex)?.raw ?? "",
      newValue: r.newValue,
    })),
  });

  try {
    await applyReplacements(replacements);
    markGroupAccepted(group.id);
    group.accepted = true;

    document.getElementById("btn-undo").style.display = "inline-flex";
    showToast(`Replaced ${replacements.length} cell${replacements.length > 1 ? "s" : ""} with "${master}".`, "success");
  } catch (err) {
    _undoStack.pop();
    showToast("Failed to apply replacement: " + (err.message || err), "error");
  }
}

// ─── Ignore ──────────────────────────────────────────────────────────────────

function handleIgnore(group) {
  group.ignored = true;
  removeGroupCard(group.id);
  showToast("Group ignored.", "info", 2000);

  // If no more visible groups, update empty state
  const remaining = _groups.filter((g) => !g.ignored && !g.accepted);
  if (remaining.length === 0) {
    const panel = document.getElementById("results-panel");
    panel.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">✓</div>
        <p class="empty-state__title">All groups reviewed</p>
        <p class="empty-state__sub">Scan again to check for more.</p>
      </div>`;
  }
}

// ─── Undo ─────────────────────────────────────────────────────────────────────

async function runUndo() {
  if (_undoStack.length === 0) {
    showToast("Nothing to undo.", "info");
    return;
  }

  const confirmed = await showConfirm({
    title:        "Undo Last Replacement",
    message:      "This will restore the previous values. Are you sure?",
    confirmText:  "Undo",
    cancelText:   "Cancel",
    confirmStyle: "danger",
  });

  if (!confirmed) return;

  const last = _undoStack.pop();

  // Invert: write oldValue back
  const reversals = last.changes.map((c) => ({
    rowIndex: c.rowIndex,
    newValue: c.oldValue,
  }));

  try {
    await applyReplacements(reversals);
    showToast("Replacement undone.", "success");

    // Restore group state in UI
    const group = _groups.find((g) => g.id === last.groupId);
    if (group) {
      group.accepted = false;
      // Re-render the entire panel to reflect restored state
      renderGroups(
        document.getElementById("results-panel"),
        _groups,
        { onAccept: handleAccept, onIgnore: handleIgnore }
      );
    }

    if (_undoStack.length === 0) {
      document.getElementById("btn-undo").style.display = "none";
    }
  } catch (err) {
    showToast("Undo failed: " + (err.message || err), "error");
  }
}
