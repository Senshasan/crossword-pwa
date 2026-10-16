import { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Clock3, RotateCcw, X } from "lucide-react";
import { type Clue, type PuzzleData } from "@/lib/crossword";
import { CategoryTag } from "@/components/PuzzleBits";
import { de } from "@/lib/strings";

const t = de.play;

const keyFor = (row: number, col: number) => `${row}:${col}`;

function wordKeys(puzzle: PuzzleData, clue: Clue) {
  const keys: string[] = [];
  for (
    let r = clue.row, c = clue.col;
    r < puzzle.dimensions.rows && c < puzzle.dimensions.cols && !puzzle.grid[r][c].isBlocked;
    clue.direction === "across" ? c++ : r++
  )
    keys.push(keyFor(r, c));
  return keys;
}

interface PlayScreenProps {
  active: PuzzleData;
  answers: Record<string, string>;
  cursor: { row: number; col: number };
  activeClue: Clue | undefined;
  wordCells: { row: number; col: number }[];
  time: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onKey: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onCell: (row: number, col: number, toggle: boolean) => void;
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
  activeClue,
  wordCells,
  time,
  inputRef,
  onKey,
  onCell,
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
  const isActive = (clue: Clue) =>
    activeClue?.number === clue.number && activeClue?.direction === clue.direction;

  // Reset wipes the grid, so it takes a second tap within 3 seconds.
  const [resetArmed, setResetArmed] = useState(false);
  const resetTimer = useRef<number | null>(null);
  useEffect(() => () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
  }, []);
  function handleReset() {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    if (resetArmed) {
      setResetArmed(false);
      onReset();
      return;
    }
    setResetArmed(true);
    resetTimer.current = window.setTimeout(() => setResetArmed(false), 3000);
  }

  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (modal) closeRef.current?.focus();
  }, [modal]);

  return (
    <main className="min-h-screen bg-background text-foreground pb-safe">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8 pt-safe">
        <button className="back-link" onClick={onBack}>
          <ChevronLeft size={18} /> {t.back}
        </button>
        <div className="timer" aria-label={t.time(time)}>
          <Clock3 size={16} /> {time}
        </div>
      </header>
      <section className="mx-auto max-w-6xl px-5 pb-12 sm:px-8">
        <div className="play-header">
          <div>
            <h1>{active.title}</h1>
            <div className="meta mt-2">
              <CategoryTag puzzle={active} />
              <span>
                {active.dimensions.cols}×{active.dimensions.rows}
              </span>
            </div>
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
          aria-label={t.inputLabel}
        />
        <div className="play-layout">
          <div className="grid-wrap">
            <div className="clue-bar" aria-live="polite">
              <p className="clue-text">
                {activeClue && (
                  <span className="clue-ref">
                    {t.clueRef(activeClue.number, activeClue.direction)}
                  </span>
                )}
                {activeClue?.text}
              </p>
              <button className="icon-button" onClick={onPrevClue} aria-label={t.prevClue}>
                <ChevronLeft size={18} />
              </button>
              <button className="icon-button" onClick={onNextClue} aria-label={t.nextClue}>
                <ChevronRight size={18} />
              </button>
            </div>
            <div
              className="crossword-grid"
              style={{ gridTemplateColumns: `repeat(${active.dimensions.cols}, minmax(0, 1fr))` }}
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
                      aria-label={
                        cell.isBlocked
                          ? t.blockedCell
                          : t.cell(r + 1, c + 1, answers[key] ?? "")
                      }
                      tabIndex={cell.isBlocked ? -1 : 0}
                      disabled={cell.isBlocked}
                    >
                      {cell.clueNumber !== undefined && <small>{cell.clueNumber}</small>}
                      {answers[key] ?? ""}
                    </button>
                  );
                }),
              )}
            </div>
            <div className="grid-controls">
              <button className="secondary-button" onClick={onCheckWord}>
                {t.checkWord}
              </button>
              <button className="secondary-button" onClick={onCheckGrid}>
                {t.checkGrid}
              </button>
              <button
                className="quiet-button"
                onClick={handleReset}
                data-armed={resetArmed ? "" : undefined}
              >
                <RotateCcw size={16} /> {resetArmed ? t.resetConfirm : t.reset}
              </button>
            </div>
            <p className="mt-3 text-center text-xs text-muted-foreground">{t.umlautHint}</p>
          </div>
          <aside className="clue-card">
            {(["across", "down"] as const).map((dir) => (
              <div className="clue-section" key={dir}>
                <h2>{dir === "across" ? t.across : t.down}</h2>
                {active.clues[dir].map((clue) => {
                  const filled = wordKeys(active, clue).every((k) => answers[k]);
                  return (
                    <button
                      key={`${dir}-${clue.number}`}
                      className={`clue-row ${isActive(clue) ? "active" : ""} ${filled && !isActive(clue) ? "solved" : ""}`}
                      aria-current={isActive(clue) ? "true" : undefined}
                      onClick={() => onClue(clue)}
                    >
                      <span className="clue-number">{clue.number}</span>
                      <span>{clue.text}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </aside>
        </div>
      </section>
      {modal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="solved-title">
          <div className="success-modal">
            <button ref={closeRef} className="modal-close" onClick={onCloseModal} aria-label={t.close}>
              <X size={18} />
            </button>
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-brand-tint text-brand-ink">
              <Check size={28} strokeWidth={2.5} />
            </span>
            <h2 id="solved-title" className="mt-5">
              {t.solvedTitle}
            </h2>
            <p className="mt-2 text-muted-foreground">
              {active.title} {t.solvedIn} <span className="font-semibold tabular-nums text-foreground">{time}</span>
            </p>
            {active.category === "custom" && active.congratsMessage && (
              <figure className="family-note">
                <p>{active.congratsMessage}</p>
                {active.authorName && <cite>— {active.authorName}</cite>}
              </figure>
            )}
            <button className="primary-button mt-7 w-full" onClick={onBack}>
              {t.backToPuzzles}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
