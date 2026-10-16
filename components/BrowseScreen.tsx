import { useState } from "react";
import { Check, ChevronLeft } from "lucide-react";
import { DIFFICULTIES, type Difficulty, type PuzzleData } from "@/lib/crossword";
import { PuzzleCard } from "@/components/PuzzleCard";
import { de } from "@/lib/strings";

const t = de.browse;

const CATEGORY_FILTERS = [
  { key: "all", label: t.all },
  { key: "standard", label: de.puzzle.standard },
  { key: "custom", label: de.puzzle.family },
] as const;

const DIFFICULTY_FILTERS = [
  { key: "all", label: t.all },
  ...DIFFICULTIES.map((key) => ({ key, label: de.puzzle.difficulty[key] })),
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
  const [category, setCategory] = useState<"all" | "standard" | "custom">("all");
  const [difficulty, setDifficulty] = useState<"all" | Difficulty>("all");
  const [unsolvedOnly, setUnsolvedOnly] = useState(false);
  // The filters combine: a puzzle must pass all three.
  const filtered = puzzles.filter(
    (p) =>
      (category === "all" || p.category === category) &&
      (difficulty === "all" || p.difficulty === difficulty) &&
      (!unsolvedOnly || !completed.includes(p.id)),
  );
  const filtering = category !== "all" || difficulty !== "all" || unsolvedOnly;
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

      <div className="mb-6 flex flex-col gap-3">
        <div className="tabs" role="group" aria-label={t.categoryFilterLabel}>
          {CATEGORY_FILTERS.map(({ key, label }) => (
            <button key={key} aria-pressed={category === key} onClick={() => setCategory(key)}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="tabs" role="group" aria-label={t.difficultyFilterLabel}>
            {DIFFICULTY_FILTERS.map(({ key, label }) => (
              <button key={key} aria-pressed={difficulty === key} onClick={() => setDifficulty(key)}>
                {label}
              </button>
            ))}
          </div>
          <button
            className="filter-toggle"
            aria-pressed={unsolvedOnly}
            onClick={() => setUnsolvedOnly((on) => !on)}
          >
            {unsolvedOnly && <Check size={15} strokeWidth={2.5} />}
            {t.unsolvedOnly}
          </button>
        </div>
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
        <p className="py-10 text-center text-muted-foreground">{filtering ? t.noMatch : t.empty}</p>
      )}
    </section>
  );
}
