import { Check } from "lucide-react";
import { type PuzzleData } from "@/lib/crossword";

export function PuzzleCard({
  puzzle,
  done,
  onOpen,
}: {
  puzzle: PuzzleData;
  done: boolean;
  onOpen: (p: PuzzleData) => void;
}) {
  return (
    <button className="puzzle-card text-left" onClick={() => onOpen(puzzle)}>
      <div
        className={`mini-grid ${puzzle.category === "custom" ? "coral" : "sage"}`}
      >
        {puzzle.grid[0].slice(0, 3).map((cell, i) => (
          <span key={i}>{cell.letter}</span>
        ))}
      </div>
      <div className="card-content">
        <div className="flex items-center justify-between">
          <span
            className={`eyebrow ${puzzle.category === "custom" ? "coral" : "sage"}`}
          >
            {puzzle.category}
          </span>
          {done && (
            <span className="done-badge">
              <Check size={12} /> Done
            </span>
          )}
        </div>
        <h3 className="mt-3 font-semibold">{puzzle.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {puzzle.clues.across[0]?.text ?? ""}
        </p>
      </div>
    </button>
  );
}
