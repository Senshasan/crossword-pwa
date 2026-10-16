import { type PuzzleData } from "@/lib/crossword";
import { de } from "@/lib/strings";

// The puzzle's real block pattern with no letters, so a preview never gives answers away.
export function PuzzleThumb({ puzzle, solved = false }: { puzzle: PuzzleData; solved?: boolean }) {
  return (
    <div
      className={`thumb ${solved ? "solved" : ""}`}
      style={{ gridTemplateColumns: `repeat(${puzzle.dimensions.cols}, minmax(0, 1fr))` }}
      aria-hidden="true"
    >
      {puzzle.grid.flat().map((cell) => (
        <span key={`${cell.row}:${cell.col}`} className={cell.isBlocked ? "b" : undefined} />
      ))}
    </div>
  );
}

export function categoryLabel(puzzle: PuzzleData) {
  if (puzzle.category === "standard") return de.puzzle.standard;
  return puzzle.authorName ? de.puzzle.fromAuthor(puzzle.authorName) : de.puzzle.family;
}

export function CategoryTag({ puzzle }: { puzzle: PuzzleData }) {
  return <span className={`tag ${puzzle.category === "custom" ? "family" : ""}`}>{categoryLabel(puzzle)}</span>;
}
