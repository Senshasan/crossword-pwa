import { ArrowRight, ChevronRight, Share } from "lucide-react";
import { type PuzzleData } from "@/lib/crossword";
import { PuzzleCard } from "@/components/PuzzleCard";
import { CategoryTag, PuzzleThumb } from "@/components/PuzzleBits";

export function HomeScreen({
  puzzles,
  completed,
  nextPuzzle,
  isStandalone,
  onOpen,
  onBrowse,
}: {
  puzzles: PuzzleData[];
  completed: string[];
  nextPuzzle: PuzzleData;
  isStandalone: boolean;
  onOpen: (puzzle: PuzzleData) => void;
  onBrowse: () => void;
}) {
  const allSolved = puzzles.length > 0 && puzzles.every((p) => completed.includes(p.id));
  const teaser = nextPuzzle.clues.across[0];

  return (
    <section className="mx-auto max-w-6xl px-5 pb-16 sm:px-8">
      <div className="hero">
        <div>
          <h1>
            A little time together, <em>one square at a time.</em>
          </h1>
          <p className="mt-5 max-w-md text-[17px] leading-7 text-muted-foreground">
            A free, ad-free crossword collection made for family and friends.
          </p>
        </div>
        {!isStandalone && (
          <div className="hero-note">
            <Share size={18} />
            <p>
              On iPhone? Use Safari&apos;s Share menu to add this app to your Home Screen.
            </p>
          </div>
        )}
      </div>

      <div className="section-heading mt-14">
        <h2>{allSolved ? "Every puzzle solved" : "Pick up where you left off"}</h2>
      </div>
      <button className="continue-card" onClick={() => onOpen(nextPuzzle)}>
        <PuzzleThumb puzzle={nextPuzzle} solved={completed.includes(nextPuzzle.id)} />
        <div className="min-w-0">
          <h3>{nextPuzzle.title}</h3>
          <div className="meta mt-1.5">
            <CategoryTag puzzle={nextPuzzle} />
          </div>
          {teaser && !allSolved && (
            <p className="teaser mt-2 truncate">
              {teaser.number} Across: {teaser.text}
            </p>
          )}
        </div>
        <span className="play-circle" aria-hidden="true">
          <ArrowRight size={22} />
        </span>
      </button>

      <div className="section-heading mt-14">
        <h2>The collection</h2>
        <button className="browse-link" onClick={onBrowse}>
          See all {puzzles.length} <ChevronRight size={16} />
        </button>
      </div>
      <div className="puzzle-grid preview-grid">
        {puzzles.slice(0, 3).map((puzzle) => (
          <PuzzleCard
            key={puzzle.id}
            puzzle={puzzle}
            done={completed.includes(puzzle.id)}
            onOpen={onOpen}
          />
        ))}
      </div>
    </section>
  );
}
