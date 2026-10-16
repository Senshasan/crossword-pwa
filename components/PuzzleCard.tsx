import { Check } from "lucide-react";
import { type PuzzleData } from "@/lib/crossword";
import { CategoryTag, DifficultyTag, PuzzleThumb } from "@/components/PuzzleBits";
import { de } from "@/lib/strings";

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
    <button
      className={`puzzle-card ${puzzle.category === "custom" ? "family" : ""}`}
      onClick={() => onOpen(puzzle)}
    >
      <div className="thumb-wrap">
        <PuzzleThumb puzzle={puzzle} solved={done} />
      </div>
      <div className="card-content">
        <h3>{puzzle.title}</h3>
        <div className="meta mt-2">
          <CategoryTag puzzle={puzzle} />
          <DifficultyTag puzzle={puzzle} />
          {done && (
            <span className="done-badge">
              <Check size={13} strokeWidth={2.5} /> {de.puzzle.solved}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
