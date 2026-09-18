"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  ChevronRight,
  Grid2X2,
  LogOut,
  Moon,
  Sun,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { type Clue, type Direction, type PuzzleData } from "@/lib/crossword";

import { useAuth } from "@/hooks/useAuth";
import { usePuzzles } from "@/hooks/usePuzzles";
import { usePuzzleProgress } from "@/hooks/usePuzzleProgress";

import { AuthScreen } from "@/components/AuthScreen";
import { ProfileScreen } from "@/components/ProfileScreen";
import { LoadingScreen } from "@/components/LoadingScreen";
import { PuzzleCard } from "@/components/PuzzleCard";
import { PlayScreen } from "@/components/PlayScreen";

const keyFor = (row: number, col: number) => `${row}:${col}`;
const allCells = (p: PuzzleData) =>
  p.grid.flat().filter((cell) => !cell.isBlocked);

const emptyPuzzle: PuzzleData = {
  id: "",
  title: "",
  category: "standard",
  orderIndex: 0,
  dimensions: { rows: 1, cols: 1 },
  clues: { across: [], down: [] },
  grid: [[{ row: 0, col: 0, letter: "", isBlocked: true }]],
};

export default function Page() {
  const supabase = useMemo(() => createClient(), []);
  
  const { user, authChecked, profileReady, name, saveProfile } = useAuth(supabase);
  const { puzzles, puzzleLoading, completed, setCompleted } = usePuzzles(supabase, user?.id);

  const [dark, setDark] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [view, setView] = useState<"home" | "browse" | "play">("home");
  const [filter, setFilter] = useState<"all" | "standard" | "custom">("all");
  const [active, setActive] = useState<PuzzleData>(emptyPuzzle);
  const [direction, setDirection] = useState<Direction>("across");
  const [cursor, setCursor] = useState({ row: 0, col: 0 });
  const [modal, setModal] = useState(false);
  const [wrongCells, setWrongCells] = useState<Set<string>>(new Set());
  const [toastMsg, setToastMsg] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);

  const {
    answers,
    setAnswers,
    seconds,
    secondsRef,
    saveProgress,
    loadPuzzleProgress,
    resetProgress,
  } = usePuzzleProgress(supabase, user, active, view, modal);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    const handleDown = (e: PointerEvent) => {
      if (!(e.target as Element).closest(".account-popover-container")) {
        setMenuOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    if (menuOpen) {
      document.addEventListener("pointerdown", handleDown);
      document.addEventListener("keydown", handleKey);
    }
    return () => {
      document.removeEventListener("pointerdown", handleDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  const filtered = puzzles.filter(
    (p) => filter === "all" || p.category === filter,
  );
  
  const nextPuzzle =
    puzzles.find((p) => !completed.includes(p.id)) ?? (puzzles.length > 0 ? puzzles[0] : emptyPuzzle);

  function getWordCells(puzzle: PuzzleData, clue: Clue) {
    const cells: { row: number; col: number }[] = [];
    let r = clue.row,
      c = clue.col;
    while (
      r < puzzle.dimensions.rows &&
      c < puzzle.dimensions.cols &&
      !puzzle.grid[r][c].isBlocked
    ) {
      cells.push({ row: r, col: c });
      if (clue.direction === "across") c++;
      else r++;
    }
    return cells;
  }

  function findActiveClue(
    puzzle: PuzzleData,
    cursor: { row: number; col: number },
    direction: Direction,
  ) {
    const cell = puzzle.grid[cursor.row][cursor.col];
    const id = direction === "across" ? cell.acrossClueId : cell.downClueId;
    return id === undefined
      ? puzzle.clues[direction][0]
      : puzzle.clues[direction][id];
  }

  const activeClue = active.id ? findActiveClue(active, cursor, direction) : undefined;
  const wordCells = activeClue ? getWordCells(active, activeClue) : [];
  const time = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  async function openPuzzle(puzzle: PuzzleData) {
    if (!puzzle.id) return;
    setActive(puzzle);
    setView("play");
    setModal(false);
    setWrongCells(new Set());
    
    const first = allCells(puzzle)[0];
    if (first) {
      setCursor({ row: first.row, col: first.col });
      setDirection("across");
    }
    
    await loadPuzzleProgress(puzzle);
    window.setTimeout(() => inputRef.current?.focus(), 100);
  }

  function focusCell(row: number, col: number, toggle = false) {
    const cell = active.grid[row][col];
    if (cell.isBlocked) return;
    if (
      toggle &&
      cell.acrossClueId !== undefined &&
      cell.downClueId !== undefined
    )
      setDirection((d) => (d === "across" ? "down" : "across"));
    setCursor({ row, col });
    setWrongCells(new Set());
    inputRef.current?.focus();
  }

  function setLetter(letter: string) {
    const cell = active.grid[cursor.row][cursor.col];
    if (!cell || cell.isBlocked) return;
    const next = {
      ...answers,
      [keyFor(cursor.row, cursor.col)]: letter.toUpperCase(),
    };
    setAnswers(next);
    
    setWrongCells((prev) => {
      const newSet = new Set(prev);
      newSet.delete(keyFor(cursor.row, cursor.col));
      return newSet;
    });

    const nextCell =
      wordCells[
        wordCells.findIndex(
          (c) => c.row === cursor.row && c.col === cursor.col,
        ) + 1
      ];
    if (nextCell) setCursor({ row: nextCell.row, col: nextCell.col });
    
    if (
      allCells(active).every((c) => next[keyFor(c.row, c.col)] === c.letter)
    ) {
      setCompleted((items) => [...new Set([...items, active.id])]);
      setModal(true);
      saveProgress(next, true);
    } else saveProgress(next, false);
  }

  function handleKey(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (/^[a-zA-Z]$/.test(event.key)) {
      event.preventDefault();
      setLetter(event.key);
      return;
    }
    if (event.key === "Backspace") {
      event.preventDefault();
      const current = keyFor(cursor.row, cursor.col);
      if (answers[current]) {
        setAnswers({ ...answers, [current]: "" });
      } else {
        const index = wordCells.findIndex(
          (c) => c.row === cursor.row && c.col === cursor.col,
        );
        const previous = wordCells[index - 1];
        if (previous) {
          setCursor({ row: previous.row, col: previous.col });
          setAnswers({ ...answers, [keyFor(previous.row, previous.col)]: "" });
        }
      }
      return;
    }
    if (
      ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
    ) {
      event.preventDefault();
      moveArrow(event.key);
    }
  }

  function moveArrow(key: string) {
    const delta =
      key === "ArrowLeft"
        ? [0, -1]
        : key === "ArrowRight"
          ? [0, 1]
          : key === "ArrowUp"
            ? [-1, 0]
            : [1, 0];
    let r = cursor.row + delta[0],
      c = cursor.col + delta[1];
    while (
      r >= 0 &&
      c >= 0 &&
      r < active.dimensions.rows &&
      c < active.dimensions.cols &&
      active.grid[r][c].isBlocked
    ) {
      r += delta[0];
      c += delta[1];
    }
    if (
      r >= 0 &&
      c >= 0 &&
      r < active.dimensions.rows &&
      c < active.dimensions.cols
    )
      focusCell(r, c);
  }

  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 2500);
  }

  function checkWord() {
    const next = { ...answers };
    const wrongs = new Set<string>();
    let allCorrect = true;
    let checkedCount = 0;

    wordCells.forEach((cell) => {
      const key = keyFor(cell.row, cell.col);
      const expected = active.grid[cell.row][cell.col].letter;
      const current = next[key];
      
      if (current) {
        checkedCount++;
        if (current !== expected) {
          wrongs.add(key);
          next[key] = "";
          allCorrect = false;
        }
      }
    });

    setAnswers(next);
    setWrongCells(wrongs);
    saveProgress(next, false);
    
    if (allCorrect && checkedCount === wordCells.length) {
      showToast("Word is correct!");
    }
  }

  function checkGrid() {
    const next = { ...answers };
    const wrongs = new Set<string>();
    let allCorrect = true;
    let checkedCount = 0;

    allCells(active).forEach((cell) => {
      const key = keyFor(cell.row, cell.col);
      const expected = cell.letter;
      const current = next[key];

      if (current) {
        checkedCount++;
        if (current !== expected) {
          wrongs.add(key);
          next[key] = "";
          allCorrect = false;
        }
      }
    });

    setAnswers(next);
    setWrongCells(wrongs);
    saveProgress(next, false);

    if (allCorrect && checkedCount === allCells(active).length) {
      showToast("Grid is correct!");
    }
  }

  function handleNextClue() {
    const allClues = [...active.clues.across, ...active.clues.down].sort((a, b) =>
      a.number !== b.number ? a.number - b.number : a.direction === "across" ? -1 : 1
    );
    if (!activeClue) return;
    const idx = allClues.findIndex(c => c.number === activeClue.number && c.direction === activeClue.direction);
    const next = allClues[(idx + 1) % allClues.length];
    setCursor({ row: next.row, col: next.col });
    setDirection(next.direction);
    inputRef.current?.focus();
  }

  function handlePrevClue() {
    const allClues = [...active.clues.across, ...active.clues.down].sort((a, b) =>
      a.number !== b.number ? a.number - b.number : a.direction === "across" ? -1 : 1
    );
    if (!activeClue) return;
    const idx = allClues.findIndex(c => c.number === activeClue.number && c.direction === activeClue.direction);
    const prev = allClues[(idx - 1 + allClues.length) % allClues.length];
    setCursor({ row: prev.row, col: prev.col });
    setDirection(prev.direction);
    inputRef.current?.focus();
  }

  if (!authChecked) return <LoadingScreen />;
  if (!user) return <AuthScreen supabase={supabase} />;
  if (!profileReady) return <ProfileScreen onSave={saveProfile} />;
  if (puzzleLoading) return <LoadingScreen />;

  if (!puzzles.length)
    return (
      <main className="auth-shell">
        <div className="auth-card">
          <span className="brand-mark">
            <Grid2X2 size={19} />
          </span>
          <h1 className="mt-5 text-2xl font-semibold">
            Your collection is getting ready
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            No puzzles have been added yet.
          </p>
        </div>
      </main>
    );

  if (view === "play")
    return (
      <div className="relative">
        <PlayScreen
          active={active}
          answers={answers}
          cursor={cursor}
          direction={direction}
          activeClue={activeClue}
          wordCells={wordCells}
          seconds={seconds}
          time={time}
          inputRef={inputRef}
          onKey={handleKey}
          onCell={focusCell}
          onDirection={setDirection}
          onClue={(clue: Clue) => {
            setCursor({ row: clue.row, col: clue.col });
            setDirection(clue.direction);
            inputRef.current?.focus();
          }}
          onBack={() => setView("home")}
          onCheckWord={checkWord}
          onCheckGrid={checkGrid}
          onReset={resetProgress}
          modal={modal}
          onCloseModal={() => setModal(false)}
          wrongCells={wrongCells}
          onNextClue={handleNextClue}
          onPrevClue={handlePrevClue}
        />
        {toastMsg && (
          <div className="fixed bottom-10 left-1/2 transform -translate-x-1/2 bg-foreground text-background px-4 py-2 rounded shadow-lg z-50 text-sm font-medium animate-in fade-in slide-in-from-bottom-4">
            {toastMsg}
          </div>
        )}
      </div>
    );

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <button
          className="flex items-center gap-3"
          onClick={() => setView("home")}
        >
          <span className="brand-mark">
            <Grid2X2 size={19} />
          </span>
          <span className="text-lg font-semibold">Across & Along</span>
        </button>
        <div className="flex items-center gap-2">
          <button
            className="icon-button"
            onClick={() => setDark(!dark)}
            aria-label="Toggle theme"
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <div className="relative account-popover-container">
            <button
              className="avatar"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Account"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              {name.slice(0, 2).toUpperCase()}
            </button>
            {menuOpen && (
              <div className="account-menu">
                <div className="px-2 pt-1 pb-2">
                  <p className="font-semibold">{name}</p>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                </div>
                <button
                  className="secondary-button w-full"
                  onClick={() => {
                    setMenuOpen(false);
                    supabase.auth.signOut();
                  }}
                >
                  <LogOut size={16} /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {view === "browse" ? (
        <section className="mx-auto max-w-6xl px-5 pb-16 sm:px-8 mt-8">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-semibold">Browse Puzzles</h1>
            <button className="browse-link" onClick={() => setView("home")}>
              Back to Home
            </button>
          </div>
          
          <div className="flex items-center gap-4 mb-8 border-b border-border">
            {(["all", "standard", "custom"] as const).map((f) => (
              <button
                key={f}
                className={`pb-3 text-sm font-medium border-b-2 ${
                  filter === f
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setFilter(f)}
              >
                {f === "all" ? "All Puzzles" : f === "standard" ? "Standard" : "Custom Family"}
              </button>
            ))}
          </div>

          <div className="puzzle-grid">
            {filtered.map((puzzle) => (
              <PuzzleCard
                key={puzzle.id}
                puzzle={puzzle}
                done={completed.includes(puzzle.id)}
                onOpen={openPuzzle}
              />
            ))}
          </div>
        </section>
      ) : (
        <section className="mx-auto max-w-6xl px-5 pb-16 sm:px-8">
          <div className="hero">
            <div>
              <p className="eyebrow sage">Your private collection</p>
              <h1 className="mt-3 max-w-xl text-4xl font-semibold tracking-tight sm:text-6xl">
                A little time together, one square at a time.
              </h1>
              <p className="mt-5 max-w-lg leading-7 text-muted-foreground">
                A free, ad-free crossword collection made for family and friends.
              </p>
            </div>
            <div className="hero-note">
              <BookOpen size={18} />
              <p className="text-sm leading-5">
                On iPhone? Use Safari&apos;s Share menu to add this app to your
                Home Screen.
              </p>
            </div>
          </div>
          <div className="mt-14 flex items-end justify-between">
            <div>
              <p className="eyebrow">Continue</p>
              <h2 className="mt-2 text-2xl font-semibold">
                Pick up where you left off
              </h2>
            </div>
            <button className="browse-link" onClick={() => setView("browse")}>
              Browse all <ChevronRight size={16} />
            </button>
          </div>
          <button
            className="continue-card mt-5 w-full text-left"
            onClick={() => openPuzzle(nextPuzzle)}
          >
            <div>
              <span
                className={`eyebrow ${nextPuzzle.category === "custom" ? "coral" : "sage"}`}
              >
                {nextPuzzle.category === "custom"
                  ? "Family custom"
                  : "Standard puzzle"}
              </span>
              <h3 className="mt-3 text-2xl font-semibold">{nextPuzzle.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {nextPuzzle.clues.across[0]?.text ?? ""}
              </p>
            </div>
            <span className="play-circle">
              <ChevronRight size={23} />
            </span>
          </button>
          <div className="section-heading mt-14">
            <div>
              <p className="eyebrow">The collection</p>
              <h2 className="mt-2 text-2xl font-semibold">All puzzles</h2>
            </div>
            <button className="browse-link" onClick={() => setView("browse")}>
              See collection <ChevronRight size={16} />
            </button>
          </div>
          <div className="puzzle-grid">
            {puzzles.slice(0, 3).map((puzzle) => (
              <PuzzleCard
                key={puzzle.id}
                puzzle={puzzle}
                done={completed.includes(puzzle.id)}
                onOpen={openPuzzle}
              />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
