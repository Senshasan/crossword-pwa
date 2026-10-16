// Checks hand-entered puzzles before they go into Supabase, using the app's own
// validation (lib/crossword.ts), so a puzzle that passes here will show up in the app.
//
// Usage:
//   node scripts/validate-puzzles.mjs <file.json>
//
// <file.json> is an array of `puzzles` rows (a single row object also works), each with
// id, title, puzzle_type, difficulty, width, height, grid, clues — the same shape as the table:
//   difficulty: "easy" | "medium" | "hard" (if left out, the DB default "easy" applies)
//   grid:  flat array of width*height single letters, "#" for a blocked cell
//   clues: { "across": [{ number, text, answer, row, col }], "down": [...] }
// Grid letters and answers must be A–Z only: write Ä/Ö/Ü/ß as AE/OE/UE/SS.
// One way to get such a file from existing rows: run
//   select json_agg(p) from puzzles p;
// in the Supabase SQL editor and save the result.
//
// No network, no secrets. Needs Node 22.18+ (imports the .ts file directly); Node may
// print a harmless MODULE_TYPELESS_PACKAGE_JSON warning. Exits 1 if any puzzle fails.
import { readFileSync } from "node:fs";
import { DIFFICULTIES, mapPuzzle } from "../lib/crossword.ts";

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
  if (row.difficulty !== undefined && !DIFFICULTIES.includes(row.difficulty))
    errors.push(`difficulty must be one of ${DIFFICULTIES.join(", ")} (got ${JSON.stringify(row.difficulty)})`);
  for (const key of ["width", "height"]) {
    const v = row[key];
    if (!Number.isInteger(v) || v < 1 || v > 30) errors.push(`${key} must be an integer from 1 to 30 (got ${JSON.stringify(v)})`);
  }
  if (!Array.isArray(row.grid)) errors.push("grid must be an array");
  else if (Number.isInteger(row.width) && Number.isInteger(row.height) && row.grid.length !== row.width * row.height)
    errors.push(`grid has ${row.grid.length} cells, expected width*height = ${row.width * row.height}`);
  if (!row.clues || !Array.isArray(row.clues.across) || !Array.isArray(row.clues.down))
    errors.push('clues must be { "across": [...], "down": [...] }');
  return errors.concat(letterErrors(row));
}

// Ä/Ö/Ü/ß (or any other non-A–Z letter) can't be typed into the grid, so they must never get in.
function letterErrors(row) {
  const errors = [];
  if (Array.isArray(row.grid))
    row.grid.forEach((cell, i) => {
      if (cell !== "#" && !(typeof cell === "string" && /^[A-Za-z]$/.test(cell))) {
        const where = Number.isInteger(row.width) && row.width > 0 ? ` (row ${Math.floor(i / row.width)}, col ${i % row.width})` : "";
        errors.push(`grid cell ${i}${where} is ${JSON.stringify(cell)}; only A–Z or "#" allowed`);
      }
    });
  for (const dir of ["across", "down"])
    for (const clue of row.clues?.[dir] ?? [])
      if (typeof clue?.answer !== "string" || !/^[A-Za-z]+$/.test(clue.answer))
        errors.push(`${clue?.number ?? "?"} ${dir}: answer ${JSON.stringify(clue?.answer)} must be A–Z only (Ä→AE, Ö→OE, Ü→UE, ß→SS)`);
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
    if (row.difficulty === undefined) console.log('        note: no difficulty given; the database will use "easy"');
  }
}

console.log(`\n${rows.length - failed}/${rows.length} passed`);
process.exit(failed ? 1 : 0);
