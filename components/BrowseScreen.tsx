import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { type PuzzleData } from "@/lib/crossword";
import { PuzzleCard } from "@/components/PuzzleCard";
import { de } from "@/lib/strings";

const t = de.browse;

const FILTERS = [
  { key: "all", label: t.all },
  { key: "standard", label: de.puzzle.standard },
  { key: "custom", label: de.puzzle.family },
] as const;

export function BrowseScreen({
  puzzles,
  completed,
  onOpen,
  onHome,
}: {
  puzzles: PuzzleData[];
  completed: string[];
  onOpen: (puzzle: PuzzleData) => void;
  onHome: () => void;
}) {
  const [filter, setFilter] = useState<"all" | "standard" | "custom">("all");
  const filtered = puzzles.filter((p) => filter === "all" || p.category === filter);
  const solvedCount = puzzles.filter((p) => completed.includes(p.id)).length;

  return (
    <section className="mx-auto max-w-6xl px-5 pb-16 sm:px-8">
      <button className="back-link" onClick={onHome}>
        <ChevronLeft size={17} /> {t.back}
      </button>
      <div className="mt-2 mb-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h1 className="text-[2.4rem] leading-tight">{t.title}</h1>
        <p className="text-sm text-muted-foreground">
          {t.solvedCount(solvedCount, puzzles.length)}
        </p>
      </div>

      <div className="tabs mb-6" role="group" aria-label={t.filterLabel}>
        {FILTERS.map(({ key, label }) => (
          <button key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>
            {label}
          </button>
        ))}
      </div>

      {filtered.length ? (
        <div className="puzzle-grid">
          {filtered.map((puzzle) => (
            <PuzzleCard
              key={puzzle.id}
              puzzle={puzzle}
              done={completed.includes(puzzle.id)}
              onOpen={onOpen}
            />
          ))}
        </div>
      ) : (
        <p className="py-10 text-center text-muted-foreground">{t.empty}</p>
      )}
    </section>
  );
}
