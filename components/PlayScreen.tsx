import {
  ArrowDown,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  RotateCcw,
  X,
} from "lucide-react";
import { type Clue, type Direction, type PuzzleData } from "@/lib/crossword";

const keyFor = (row: number, col: number) => `${row}:${col}`;

interface PlayScreenProps {
  active: PuzzleData;
  answers: Record<string, string>;
  cursor: { row: number; col: number };
  direction: Direction;
  activeClue: Clue | undefined;
  wordCells: { row: number; col: number }[];
  seconds: number;
  time: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onKey: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onCell: (row: number, col: number, toggle: boolean) => void;
  onDirection: (direction: Direction) => void;
  onClue: (clue: Clue) => void;
  onBack: () => void;
  onCheckWord: () => void;
  onCheckGrid: () => void;
  onReset: () => void;
  modal: boolean;
  onCloseModal: () => void;
  wrongCells: Set<string>;
  onNextClue: () => void;
  onPrevClue: () => void;
}

export function PlayScreen({
  active,
  answers,
  cursor,
  direction,
  activeClue,
  wordCells,
  seconds,
  time,
  inputRef,
  onKey,
  onCell,
  onDirection,
  onClue,
  onBack,
  onCheckWord,
  onCheckGrid,
  onReset,
  modal,
  onCloseModal,
  wrongCells,
  onNextClue,
  onPrevClue,
}: PlayScreenProps) {
  const wordSet = new Set(wordCells.map((c) => keyFor(c.row, c.col)));

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <button className="back-link" onClick={onBack}>
          <ChevronLeft size={17} /> Back to puzzles
        </button>
        <div className="timer">
          <Clock3 size={17} /> {time}
        </div>
      </header>
      <section className="mx-auto max-w-6xl px-5 pb-12 sm:px-8">
        <div className="play-header">
          <div>
            <span
              className={`eyebrow ${active.category === "custom" ? "coral" : "sage"}`}
            >
              {active.category === "custom"
                ? "Family custom"
                : "Standard puzzle"}
            </span>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              {active.title}
            </h1>
          </div>
        </div>
        <input
          ref={inputRef}
          className="keyboard-input"
          autoFocus
          onKeyDown={onKey}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
          aria-label="Type crossword letters"
        />
        <div className="play-layout mt-8">
          <div className="grid-wrap">
            <div
              className="crossword-grid real-grid"
              style={{
                gridTemplateColumns: `repeat(${active.dimensions.cols}, minmax(0, 1fr))`,
              }}
              role="grid"
              onClick={() => inputRef.current?.focus()}
            >
              {active.grid.map((row, r) =>
                row.map((cell, c) => {
                  const key = keyFor(r, c);
                  return (
                    <button
                      key={key}
                      className={`cell ${cell.isBlocked ? "blocked" : ""} ${wordSet.has(key) ? "word-active" : ""} ${cursor.row === r && cursor.col === c ? "selected" : ""} ${wrongCells.has(key) ? "wrong" : ""}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onCell(r, c, cursor.row === r && cursor.col === c);
                      }}
                      aria-label={`Row ${r + 1}, column ${c + 1}`}
                      tabIndex={cell.isBlocked ? -1 : 0}
                      disabled={cell.isBlocked}
                    >
                      {cell.clueNumber !== undefined && (
                        <small>{cell.clueNumber}</small>
                      )}
                      {answers[key] ?? ""}
                    </button>
                  );
                }),
              )}
            </div>
            <div className="grid-controls flex gap-2 mt-4">
              <button className="secondary-button" onClick={onReset}>
                <RotateCcw size={16} /> Reset
              </button>
              <button className="secondary-button" onClick={onCheckWord}>
                Check Word
              </button>
              <button className="secondary-button" onClick={onCheckGrid}>
                Check Grid
              </button>
            </div>
          </div>
          <aside className="clue-card">
            <div className="sticky-clue">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <span className="clue-number">{activeClue?.number}</span>
                  <span className="clue-dir" aria-label={activeClue?.direction}>
                    {activeClue?.direction === "across" ? (
                      <ArrowRight size={14} />
                    ) : (
                      <ArrowDown size={14} />
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button className="icon-button" onClick={onPrevClue} aria-label="Previous clue">
                    <ChevronLeft size={16} />
                  </button>
                  <button className="icon-button" onClick={onNextClue} aria-label="Next clue">
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
              <p className="mt-2">{activeClue?.text}</p>
            </div>
            <div className="clue-list">
              {[...active.clues.across, ...active.clues.down]
                .sort((a, b) =>
                  a.number !== b.number
                    ? a.number - b.number
                    : a.direction === "across"
                      ? -1
                      : 1,
                )
                .map((clue: Clue) => (
                  <button
                    key={`${clue.direction}-${clue.number}`}
                    className={`clue-row ${activeClue?.number === clue.number && activeClue?.direction === clue.direction ? "active" : ""}`}
                    onClick={() => onClue(clue)}
                  >
                    <span className="clue-number">{clue.number}</span>
                    <span className="clue-dir" aria-label={clue.direction}>
                      {clue.direction === "across" ? (
                        <ArrowRight size={14} />
                      ) : (
                        <ArrowDown size={14} />
                      )}
                    </span>
                    <span>{clue.text}</span>
                  </button>
                ))}
            </div>
          </aside>
        </div>
      </section>
      {modal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="success-modal">
            <button
              className="modal-close"
              onClick={onCloseModal}
              aria-label="Close"
            >
              <X size={18} />
            </button>
            <span className="brand-mark large">
              <Check size={25} />
            </span>
            <p className="eyebrow sage mt-6">Puzzle complete</p>
            <h2 className="mt-2 text-3xl font-semibold">Well done.</h2>
            <p className="mt-3 text-muted-foreground">Solved in {time}.</p>
            {active.category === "custom" && (
              <p className="mt-5 leading-6">
                {active.congratsMessage}
                <br />
                {active.authorName && (
                  <span className="text-sm text-muted-foreground">
                    — {active.authorName}
                  </span>
                )}
              </p>
            )}
            <button
              className="primary-button mt-7 w-full"
              onClick={onCloseModal}
            >
              Keep solving
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
