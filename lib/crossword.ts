export type Direction = "across" | "down";

export interface Clue {
  number: number;
  direction: Direction;
  text: string;
  answer: string;
  row: number;
  col: number;
}

export interface CellData {
  row: number;
  col: number;
  letter: string;
  isBlocked: boolean;
  clueNumber?: number;
  acrossClueId?: number;
  downClueId?: number;
}

export interface PuzzleData {
  id: string;
  title: string;
  category: "standard" | "custom";
  orderIndex: number;
  authorName?: string;
  congratsMessage?: string;
  dimensions: { rows: number; cols: number };
  clues: { across: Clue[]; down: Clue[] };
  grid: CellData[][];
}

export function validatePuzzleData(puzzle: PuzzleData): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check grid dimensions
  if (puzzle.grid.length !== puzzle.dimensions.rows) {
    errors.push(
      `Grid has ${puzzle.grid.length} rows, expected ${puzzle.dimensions.rows}`,
    );
  }
  for (let i = 0; i < puzzle.grid.length; i++) {
    if (puzzle.grid[i].length !== puzzle.dimensions.cols) {
      errors.push(
        `Row ${i} has ${puzzle.grid[i].length} columns, expected ${puzzle.dimensions.cols}`,
      );
    }
  }

  // Check clue consistency
  const allClues = [...puzzle.clues.across, ...puzzle.clues.down];
  const clueById = new Map(
    allClues.map((clue, idx) => [
      `${clue.direction}-${clue.number}`,
      { idx, clue, direction: clue.direction },
    ]),
  );

  // Verify each clue starts at the correct cell
  for (const clue of allClues) {
    if (clue.row < 0 || clue.row >= puzzle.dimensions.rows) {
      errors.push(
        `${clue.direction} clue ${clue.number} has invalid row ${clue.row}`,
      );
      continue;
    }
    if (clue.col < 0 || clue.col >= puzzle.dimensions.cols) {
      errors.push(
        `${clue.direction} clue ${clue.number} has invalid col ${clue.col}`,
      );
      continue;
    }

    const cell = puzzle.grid[clue.row][clue.col];
    if (cell.isBlocked) {
      errors.push(
        `${clue.direction} clue ${clue.number} starts at blocked cell (${clue.row}, ${clue.col})`,
      );
    }

    // Verify the answer matches the grid
    let answerIdx = 0;
    let r = clue.row;
    let c = clue.col;
    const dr = clue.direction === "down" ? 1 : 0;
    const dc = clue.direction === "across" ? 1 : 0;

    while (r < puzzle.dimensions.rows && c < puzzle.dimensions.cols) {
      const gridCell = puzzle.grid[r][c];
      if (gridCell.isBlocked) break;

      if (answerIdx < clue.answer.length) {
        const expectedLetter = clue.answer[answerIdx].toUpperCase();
        const gridLetter = gridCell.letter.toUpperCase();

        if (gridLetter !== expectedLetter) {
          errors.push(
            `${clue.direction} clue ${clue.number} answer mismatch at (${r}, ${c}): expected '${expectedLetter}', grid has '${gridLetter}'`,
          );
        }
      }

      r += dr;
      c += dc;
      answerIdx++;
    }

    if (answerIdx !== clue.answer.length) {
      errors.push(
        `${clue.direction} clue ${clue.number} answer length ${clue.answer.length} doesn't match grid word length ${answerIdx}`,
      );
    }
  }

  // Verify intersection consistency
  const intersections = new Map<string, Set<string>>();
  for (const clue of allClues) {
    let r = clue.row;
    let c = clue.col;
    const dr = clue.direction === "down" ? 1 : 0;
    const dc = clue.direction === "across" ? 1 : 0;
    let answerIdx = 0;

    while (r < puzzle.dimensions.rows && c < puzzle.dimensions.cols) {
      const cell = puzzle.grid[r][c];
      if (cell.isBlocked) break;

      const key = `${r},${c}`;
      if (!intersections.has(key)) intersections.set(key, new Set());
      intersections
        .get(key)!
        .add(
          answerIdx < clue.answer.length
            ? clue.answer[answerIdx].toUpperCase()
            : "",
        );

      r += dr;
      c += dc;
      answerIdx++;
    }
  }

  for (const [pos, letters] of intersections) {
    if (letters.size > 1) {
      errors.push(
        `Cell at ${pos} has conflicting letters: ${Array.from(letters).join(", ")}`,
      );
    }
  }

  // Verify canonical numbering
  let canonicalNumber = 1;
  const canonicalNumberByPos = new Map<string, number>();

  for (let r = 0; r < puzzle.dimensions.rows; r++) {
    for (let c = 0; c < puzzle.dimensions.cols; c++) {
      const cell = puzzle.grid[r][c];
      if (cell.isBlocked) continue;

      const isAcrossStart =
        (c === 0 || puzzle.grid[r][c - 1].isBlocked) &&
        c + 1 < puzzle.dimensions.cols &&
        !puzzle.grid[r][c + 1].isBlocked;
      const isDownStart =
        (r === 0 || puzzle.grid[r - 1][c].isBlocked) &&
        r + 1 < puzzle.dimensions.rows &&
        !puzzle.grid[r + 1][c].isBlocked;

      if (isAcrossStart || isDownStart) {
        const key = `${r},${c}`;
        canonicalNumberByPos.set(key, canonicalNumber);
        canonicalNumber++;
      }
    }
  }

  const seenClueNumbers = new Map<number, string>();
  for (const clue of allClues) {
    const key = `${clue.row},${clue.col}`;
    const expectedNumber = canonicalNumberByPos.get(key);

    if (expectedNumber === undefined) {
      errors.push(
        `${clue.direction} clue ${clue.number} starts at (${clue.row}, ${clue.col}) which is not a valid entry start`,
      );
    } else if (clue.number !== expectedNumber) {
      errors.push(
        `${clue.direction} clue at (${clue.row}, ${clue.col}) claims to be number ${clue.number}, but should be ${expectedNumber}`,
      );
    }

    const existingKey = seenClueNumbers.get(clue.number);
    if (existingKey && existingKey !== key) {
      if (
        !errors.includes(
          `Clue number ${clue.number} is used at multiple different start cells`,
        )
      ) {
        errors.push(
          `Clue number ${clue.number} is used at multiple different start cells`,
        );
      }
    }
    seenClueNumbers.set(clue.number, key);
  }

  // Verify clue numbers match grid
  const acrossClueNumbers = new Set(puzzle.clues.across.map((c) => c.number));
  const downClueNumbers = new Set(puzzle.clues.down.map((c) => c.number));

  for (let r = 0; r < puzzle.dimensions.rows; r++) {
    for (let c = 0; c < puzzle.dimensions.cols; c++) {
      const cell = puzzle.grid[r][c];
      if (!cell.isBlocked && cell.clueNumber !== undefined) {
        const hasAcross =
          cell.acrossClueId !== undefined &&
          acrossClueNumbers.has(cell.clueNumber);
        const hasDown =
          cell.downClueId !== undefined && downClueNumbers.has(cell.clueNumber);

        if (!hasAcross && !hasDown) {
          errors.push(
            `Grid cell (${r}, ${c}) has clue number ${cell.clueNumber} but no matching across/down clue`,
          );
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
