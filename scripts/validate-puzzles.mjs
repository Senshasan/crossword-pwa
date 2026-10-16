// Checks hand-entered puzzles before they go into Supabase, using the app's own
// validation (lib/crossword.ts), so a puzzle that passes here will show up in the app.
//
// Usage:
//   node scripts/validate-puzzles.mjs <file.json>
//
// <file.json> is an array of `puzzles` rows (a single row object also works), each with
// id, title, puzzle_type, width, height, grid, clues — the same shape as the table:
//   grid:  flat array of width*height single letters, "#" for a blocked cell
//   clues: { "across": [{ number, text, answer, row, col }], "down": [...] }
// One way to get such a file from existing rows: run
//   select json_agg(p) from puzzles p;
// in the Supabase SQL editor and save the result.
//
// No network, no secrets. Needs Node 22.18+ (imports the .ts file directly); Node may
// print a harmless MODULE_TYPELESS_PACKAGE_JSON warning. Exits 1 if any puzzle fails.
import { readFileSync } from "node:fs";
import { mapPuzzle } from "../lib/crossword.ts";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/validate-puzzles.mjs <file.json>");
  process.exit(2);
}

let rows;
try {
  rows = JSON.parse(readFileSync(file, "utf8"));
} catch (err) {
  console.error(`Couldn't read ${file}: ${err.message}`);
  process.exit(2);
}
if (!Array.isArray(rows)) rows = [rows];

// mapPuzzle returns null both for malformed rows (no reason given) and for failed
// validation (reasons sent to console.warn). Spell out the first kind; capture the second.
function shapeErrors(row) {
  const errors = [];
  if (!row || typeof row !== "object") return ["row is not an object"];
  if (!row.id) errors.push("missing id");
  if (!row.title) errors.push("missing title");
  if (!["standard", "custom"].includes(row.puzzle_type))
    errors.push(`puzzle_type must be "standard" or "custom" (got ${JSON.stringify(row.puzzle_type)})`);
  for (const key of ["width", "height"]) {
    const v = row[key];
    if (!Number.isInteger(v) || v < 1 || v > 30) errors.push(`${key} must be an integer from 1 to 30 (got ${JSON.stringify(v)})`);
  }
  if (!Array.isArray(row.grid)) errors.push("grid must be an array");
  else if (Number.isInteger(row.width) && Number.isInteger(row.height) && row.grid.length !== row.width * row.height)
    errors.push(`grid has ${row.grid.length} cells, expected width*height = ${row.width * row.height}`);
  if (!row.clues || !Array.isArray(row.clues.across) || !Array.isArray(row.clues.down))
    errors.push('clues must be { "across": [...], "down": [...] }');
  return errors;
}

let failed = 0;
for (const [i, row] of rows.entries()) {
  const label = `${row?.title ?? "(untitled)"} [${row?.id ?? `row ${i}`}]`;
  let errors = shapeErrors(row);
  if (!errors.length) {
    const warn = console.warn;
    let captured = [];
    console.warn = (_msg, errs) => {
      captured = Array.isArray(errs) ? errs : [String(_msg)];
    };
    let puzzle;
    try {
      puzzle = mapPuzzle(row);
    } catch (err) {
      captured = [`crashed while mapping: ${err.message}`];
    } finally {
      console.warn = warn;
    }
    if (!puzzle) errors = captured.length ? captured : ["rejected by mapPuzzle"];
  }

  if (errors.length) {
    failed++;
    console.log(`FAIL  ${label}`);
    for (const e of errors) console.log(`        - ${e}`);
  } else {
    console.log(`PASS  ${label}`);
  }
}

console.log(`\n${rows.length - failed}/${rows.length} passed`);
process.exit(failed ? 1 : 0);
