/**
 * office.js
 * All interactions with the Excel JavaScript API are isolated here.
 * The rest of the codebase must not import Office.js directly.
 */

"use strict";

/**
 * Reads every non-empty cell value from the currently selected column.
 * Validates that exactly one column is selected.
 *
 * @returns {Promise<{ rowIndex: number, raw: string }[]>}
 * @throws {Error} with a user-friendly message on validation failure
 */
export async function readSelectedColumn() {
  return Excel.run(async (ctx) => {
    const range = ctx.workbook.getSelectedRange();
    range.load(["columnCount", "rowCount", "values", "address"]);
    await ctx.sync();

    if (range.columnCount !== 1) {
      throw new Error(
        "Please select a single column before scanning.\n" +
        `You currently have ${range.columnCount} columns selected.`
      );
    }

    if (range.rowCount < 2) {
      throw new Error(
        "The selected range has fewer than 2 rows — nothing to compare."
      );
    }

    const entries = [];
    for (let r = 0; r < range.rowCount; r++) {
      const cellVal = range.values[r][0];
      if (cellVal === null || cellVal === undefined || cellVal === "") continue;
      entries.push({ rowIndex: r, raw: String(cellVal) });
    }

    if (entries.length < 2) {
      throw new Error(
        "The selected column has fewer than 2 populated cells — nothing to compare."
      );
    }

    return entries;
  });
}

/**
 * Writes replacement values back into the spreadsheet.
 * Only updates cells whose original value matches one of the duplicates.
 *
 * @param {ReplacementSpec[]} replacements
 * @returns {Promise<void>}
 *
 * @typedef {object} ReplacementSpec
 * @property {number} rowIndex  0-based row index in the selected range
 * @property {string} newValue  The master value to write
 */
export async function applyReplacements(replacements) {
  if (!replacements || replacements.length === 0) return;

  return Excel.run(async (ctx) => {
    const range = ctx.workbook.getSelectedRange();
    range.load(["rowCount", "values", "address"]);
    await ctx.sync();

    for (const { rowIndex, newValue } of replacements) {
      if (rowIndex < 0 || rowIndex >= range.rowCount) continue;
      const cell = range.getCell(rowIndex, 0);
      cell.values = [[newValue]];
    }

    await ctx.sync();
  });
}

/**
 * Reads the current raw values for a set of row indices (used for undo verification).
 *
 * @param {number[]} rowIndices  0-based row indices within the selection
 * @returns {Promise<Map<number, string>>}  Map of rowIndex → current cell value
 */
export async function readCellValues(rowIndices) {
  return Excel.run(async (ctx) => {
    const range = ctx.workbook.getSelectedRange();
    range.load(["values", "rowCount"]);
    await ctx.sync();

    const result = new Map();
    for (const ri of rowIndices) {
      if (ri >= 0 && ri < range.rowCount) {
        const v = range.values[ri][0];
        result.set(ri, v === null || v === undefined ? "" : String(v));
      }
    }
    return result;
  });
}

/**
 * Checks whether the current selection is a protected worksheet.
 * Returns true if protected (writes are forbidden).
 *
 * @returns {Promise<boolean>}
 */
export async function isSheetProtected() {
  try {
    return Excel.run(async (ctx) => {
      const sheet = ctx.workbook.getActiveWorksheet();
      sheet.load("protection/protected");
      await ctx.sync();
      return sheet.protection.protected;
    });
  } catch {
    return false;
  }
}

/**
 * Returns true if the Office.js runtime is available and initialized.
 * @returns {boolean}
 */
export function isOfficeReady() {
  return typeof Office !== "undefined" && typeof Excel !== "undefined";
}
