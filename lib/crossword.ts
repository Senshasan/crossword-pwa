export type Direction = 'across' | 'down'

export interface Clue {
  number: number
  direction: Direction
  text: string
  answer: string
  row: number
  col: number
}

export interface CellData {
  row: number
  col: number
  letter: string
  isBlocked: boolean
  clueNumber?: number
  acrossClueId?: number
  downClueId?: number
}

export interface PuzzleData {
  id: string
  title: string
  category: 'standard' | 'custom'
  orderIndex: number
  authorName?: string
  congratsMessage?: string
  dimensions: { rows: number; cols: number }
  clues: { across: Clue[]; down: Clue[] }
  grid: CellData[][]
}

export function validatePuzzleData(puzzle: PuzzleData): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Check grid dimensions
  if (puzzle.grid.length !== puzzle.dimensions.rows) {
    errors.push(`Grid has ${puzzle.grid.length} rows, expected ${puzzle.dimensions.rows}`)
  }
  for (let i = 0; i < puzzle.grid.length; i++) {
    if (puzzle.grid[i].length !== puzzle.dimensions.cols) {
      errors.push(
        `Row ${i} has ${puzzle.grid[i].length} columns, expected ${puzzle.dimensions.cols}`
      )
    }
  }

  // Check clue consistency
  const allClues = [...puzzle.clues.across, ...puzzle.clues.down]
  const clueById = new Map(
    allClues.map((clue, idx) => [
      `${clue.direction}-${clue.number}`,
      { idx, clue, direction: clue.direction },
    ])
  )

  // Verify each clue starts at the correct cell
  for (const clue of allClues) {
    if (clue.row < 0 || clue.row >= puzzle.dimensions.rows) {
      errors.push(`${clue.direction} clue ${clue.number} has invalid row ${clue.row}`)
      continue
    }
    if (clue.col < 0 || clue.col >= puzzle.dimensions.cols) {
      errors.push(`${clue.direction} clue ${clue.number} has invalid col ${clue.col}`)
      continue
    }

    const cell = puzzle.grid[clue.row][clue.col]
    if (cell.isBlocked) {
      errors.push(
        `${clue.direction} clue ${clue.number} starts at blocked cell (${clue.row}, ${clue.col})`
      )
    }

    // Verify the answer matches the grid
    let answerIdx = 0
    let r = clue.row
    let c = clue.col
    const dr = clue.direction === 'down' ? 1 : 0
    const dc = clue.direction === 'across' ? 1 : 0

    while (r < puzzle.dimensions.rows && c < puzzle.dimensions.cols) {
      const gridCell = puzzle.grid[r][c]
      if (gridCell.isBlocked) break

      if (answerIdx < clue.answer.length) {
        const expectedLetter = clue.answer[answerIdx]
        const gridLetter = gridCell.letter.toUpperCase()

        if (gridLetter !== expectedLetter) {
          errors.push(
            `${clue.direction} clue ${clue.number} answer mismatch at (${r}, ${c}): expected '${expectedLetter}', grid has '${gridLetter}'`
          )
        }
      }

      r += dr
      c += dc
      answerIdx++
    }

    if (answerIdx !== clue.answer.length) {
      errors.push(
        `${clue.direction} clue ${clue.number} answer length ${clue.answer.length} doesn't match grid word length ${answerIdx}`
      )
    }
  }

  // Verify intersection consistency
  const intersections = new Map<string, Set<string>>()
  for (const clue of allClues) {
    let r = clue.row
    let c = clue.col
    const dr = clue.direction === 'down' ? 1 : 0
    const dc = clue.direction === 'across' ? 1 : 0
    let answerIdx = 0

    while (r < puzzle.dimensions.rows && c < puzzle.dimensions.cols) {
      const cell = puzzle.grid[r][c]
      if (cell.isBlocked) break

      const key = `${r},${c}`
      if (!intersections.has(key)) intersections.set(key, new Set())
      intersections
        .get(key)!
        .add(
          answerIdx < clue.answer.length
            ? clue.answer[answerIdx].toUpperCase()
            : ''
        )

      r += dr
      c += dc
      answerIdx++
    }
  }

  for (const [pos, letters] of intersections) {
    if (letters.size > 1) {
      errors.push(`Cell at ${pos} has conflicting letters: ${Array.from(letters).join(', ')}`)
    }
  }

  // Verify clue numbers match grid
  const acrossClueNumbers = new Set(puzzle.clues.across.map((c) => c.number))
  const downClueNumbers = new Set(puzzle.clues.down.map((c) => c.number))

  for (let r = 0; r < puzzle.dimensions.rows; r++) {
    for (let c = 0; c < puzzle.dimensions.cols; c++) {
      const cell = puzzle.grid[r][c]
      if (!cell.isBlocked && cell.clueNumber !== undefined) {
        const hasAcross =
          cell.acrossClueId !== undefined && acrossClueNumbers.has(cell.clueNumber)
        const hasDown = cell.downClueId !== undefined && downClueNumbers.has(cell.clueNumber)

        if (!hasAcross && !hasDown) {
          errors.push(
            `Grid cell (${r}, ${c}) has clue number ${cell.clueNumber} but no matching across/down clue`
          )
        }
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

// Sample puzzle 1: Standard 5x5
export const sampleStandard: PuzzleData = {
  id: 'sample-standard',
  title: 'The Sunday Stroll',
  category: 'standard',
  orderIndex: 1,
  dimensions: { rows: 5, cols: 5 },
  clues: {
    across: [
      { number: 1, direction: 'across', text: 'A friendly greeting', answer: 'HELLO', row: 0, col: 0 },
      { number: 4, direction: 'across', text: 'Our planet', answer: 'EARTH', row: 1, col: 0 },
      { number: 7, direction: 'across', text: 'Woolly animal', answer: 'LLAMA', row: 2, col: 0 },
      { number: 9, direction: 'across', text: 'Big cats', answer: 'LIONS', row: 3, col: 0 },
      { number: 11, direction: 'across', text: 'Desert spring', answer: 'OASIS', row: 4, col: 0 },
    ],
    down: [
      { number: 1, direction: 'down', text: 'A familiar greeting', answer: 'HELLO', row: 0, col: 0 },
      { number: 2, direction: 'down', text: 'A rare name', answer: 'EALIA', row: 0, col: 1 },
      { number: 3, direction: 'down', text: 'A letter mix', answer: 'LRAOS', row: 0, col: 2 },
      { number: 5, direction: 'down', text: 'A letter mix', answer: 'LTMNI', row: 0, col: 3 },
      { number: 6, direction: 'down', text: 'A letter mix', answer: 'OHASS', row: 0, col: 4 },
    ],
  },
  grid: [
    [
      { row: 0, col: 0, letter: 'H', isBlocked: false, clueNumber: 1, acrossClueId: 0 },
      { row: 0, col: 1, letter: 'E', isBlocked: false },
      { row: 0, col: 2, letter: 'L', isBlocked: false },
      { row: 0, col: 3, letter: 'L', isBlocked: false },
      { row: 0, col: 4, letter: 'O', isBlocked: false },
    ],
    [
      { row: 1, col: 0, letter: 'E', isBlocked: false, clueNumber: 4, acrossClueId: 1 },
      { row: 1, col: 1, letter: 'V', isBlocked: false },
      { row: 1, col: 2, letter: 'E', isBlocked: false },
      { row: 1, col: 3, letter: 'N', isBlocked: false },
      { row: 1, col: 4, letter: 'T', isBlocked: false },
    ],
    [
      { row: 2, col: 0, letter: 'L', isBlocked: false, clueNumber: 7, acrossClueId: 2 },
      { row: 2, col: 1, letter: 'L', isBlocked: false },
      { row: 2, col: 2, letter: 'A', isBlocked: false },
      { row: 2, col: 3, letter: 'M', isBlocked: false },
      { row: 2, col: 4, letter: 'A', isBlocked: false },
    ],
    [
      { row: 3, col: 0, letter: 'L', isBlocked: false, clueNumber: 9, acrossClueId: 3 },
      { row: 3, col: 1, letter: 'I', isBlocked: false },
      { row: 3, col: 2, letter: 'O', isBlocked: false },
      { row: 3, col: 3, letter: 'N', isBlocked: false },
      { row: 3, col: 4, letter: 'S', isBlocked: false },
    ],
    [
      { row: 4, col: 0, letter: 'O', isBlocked: false, clueNumber: 11, acrossClueId: 4 },
      { row: 4, col: 1, letter: 'A', isBlocked: false },
      { row: 4, col: 2, letter: 'S', isBlocked: false },
      { row: 4, col: 3, letter: 'I', isBlocked: false },
      { row: 4, col: 4, letter: 'S', isBlocked: false },
    ],
  ],
}

// Sample puzzle 2: Custom 5x5 with author message
export const sampleCustom: PuzzleData = {
  id: 'sample-custom',
  title: 'Birthday Surprise',
  category: 'custom',
  orderIndex: 2,
  authorName: 'The Family',
  congratsMessage: 'Happy Birthday! Made with love just for you.',
  dimensions: { rows: 5, cols: 5 },
  clues: {
    across: [
      { number: 1, direction: 'across', text: 'A festive gathering', answer: 'PARTY', row: 0, col: 0 },
      { number: 4, direction: 'across', text: 'Fruit from a tree', answer: 'APPLE', row: 1, col: 0 },
      { number: 7, direction: 'across', text: 'Flows to the sea', answer: 'RIVER', row: 2, col: 0 },
      { number: 9, direction: 'across', text: 'Something sweet', answer: 'TREAT', row: 3, col: 0 },
      { number: 11, direction: 'across', text: 'Belonging to you', answer: 'YOURS', row: 4, col: 0 },
    ],
    down: [
      { number: 1, direction: 'down', text: 'Flat surface', answer: 'PARTS'[0], row: 0, col: 0 },
      { number: 2, direction: 'down', text: 'Not complex', answer: 'PLANE'[0], row: 0, col: 1 },
      { number: 3, direction: 'down', text: 'Large body of water', answer: 'TROUT'[0], row: 0, col: 2 },
      { number: 5, direction: 'down', text: 'Valuable stone', answer: 'PEOPLE'[0], row: 0, col: 3 },
      { number: 6, direction: 'down', text: 'Food for dessert', answer: 'LAYERS'[0], row: 0, col: 4 },
    ],
  },
  grid: [
    [
      { row: 0, col: 0, letter: 'P', isBlocked: false, clueNumber: 1, acrossClueId: 0 },
      { row: 0, col: 1, letter: 'A', isBlocked: false },
      { row: 0, col: 2, letter: 'R', isBlocked: false },
      { row: 0, col: 3, letter: 'T', isBlocked: false },
      { row: 0, col: 4, letter: 'Y', isBlocked: false },
    ],
    [
      { row: 1, col: 0, letter: 'A', isBlocked: false, clueNumber: 4, acrossClueId: 1 },
      { row: 1, col: 1, letter: 'P', isBlocked: false },
      { row: 1, col: 2, letter: 'P', isBlocked: false },
      { row: 1, col: 3, letter: 'L', isBlocked: false },
      { row: 1, col: 4, letter: 'E', isBlocked: false },
    ],
    [
      { row: 2, col: 0, letter: 'R', isBlocked: false, clueNumber: 7, acrossClueId: 2 },
      { row: 2, col: 1, letter: 'I', isBlocked: false },
      { row: 2, col: 2, letter: 'V', isBlocked: false },
      { row: 2, col: 3, letter: 'E', isBlocked: false },
      { row: 2, col: 4, letter: 'R', isBlocked: false },
    ],
    [
      { row: 3, col: 0, letter: 'T', isBlocked: false, clueNumber: 9, acrossClueId: 3 },
      { row: 3, col: 1, letter: 'R', isBlocked: false },
      { row: 3, col: 2, letter: 'E', isBlocked: false },
      { row: 3, col: 3, letter: 'A', isBlocked: false },
      { row: 3, col: 4, letter: 'T', isBlocked: false },
    ],
    [
      { row: 4, col: 0, letter: 'Y', isBlocked: false, clueNumber: 11, acrossClueId: 4 },
      { row: 4, col: 1, letter: 'O', isBlocked: false },
      { row: 4, col: 2, letter: 'U', isBlocked: false },
      { row: 4, col: 3, letter: 'R', isBlocked: false },
      { row: 4, col: 4, letter: 'S', isBlocked: false },
    ],
  ],
}
