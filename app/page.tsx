"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CloudOff, Loader2, RotateCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { type Clue, type Direction, type PuzzleData } from "@/lib/crossword";

import { useAuth } from "@/hooks/useAuth";
import { usePuzzles } from "@/hooks/usePuzzles";
import { usePuzzleProgress } from "@/hooks/usePuzzleProgress";
import { useServiceWorker } from "@/hooks/useServiceWorker";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useLeaderboard } from "@/hooks/useLeaderboard";

import { AuthScreen } from "@/components/AuthScreen";
import { ProfileScreen } from "@/components/ProfileScreen";
import { LoadingScreen } from "@/components/LoadingScreen";
import { PlayScreen } from "@/components/PlayScreen";
import { UpdateBanner } from "@/components/UpdateBanner";
import { PullIndicator } from "@/components/PullIndicator";
import { AppHeader } from "@/components/AppHeader";
import { BrandMark } from "@/components/BrandMark";
import { HomeScreen } from "@/components/HomeScreen";
import { BrowseScreen } from "@/components/BrowseScreen";

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
  const { updateReady, applyUpdate, checkForUpdate } = useServiceWorker();
  
  const { user, authChecked, profileReady, name, saveProfile } = useAuth(supabase);
  const { puzzles, puzzleLoading, refreshing, error, completed, setCompleted, refetch } = usePuzzles(supabase, user?.id);

  const [dark, setDark] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [view, setView] = useState<"home" | "browse" | "play">("home");
  const [active, setActive] = useState<PuzzleData>(emptyPuzzle);
  const [direction, setDirection] = useState<Direction>("across");
  const [cursor, setCursor] = useState({ row: 0, col: 0 });
  const [modal, setModal] = useState(false);
  const [wrongCells, setWrongCells] = useState<Set<string>>(new Set());
  const [toastMsg, setToastMsg] = useState("");
  const [isStandalone, setIsStandalone] = useState(true); // true by default: no flash of the hint
  
  const {
    rows: leaderboardRows,
    loading: leaderboardLoading,
    error: leaderboardError,
    load: loadLeaderboard,
  } = useLeaderboard(supabase);

  // Pull-to-refresh (and the menu's Refresh): new puzzles and a new app version, together.
  // Home and Browse only; in Play a downward drag belongs to the grid.
  const onRefresh = useCallback(async () => {
    await Promise.allSettled([refetch(), checkForUpdate()]);
  }, [refetch, checkForUpdate]);
  const {
    pull,
    refreshing: pullRefreshing,
    refresh: pullRefresh,
  } = usePullToRefresh(onRefresh, !!user && profileReady && puzzles.length > 0 && view !== "play");

  const inputRef = useRef<HTMLInputElement>(null);
  const checkTimerRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const {
    answers,
    setAnswers,
    seconds,
    secondsRef,
    saveProgress,
    loadPuzzleProgress,
    resetProgress,
  } = usePuzzleProgress(supabase, user, active, view, modal, completed.includes(active.id));
  // Saves on a finished puzzle must keep completed=true; the client never un-completes.
  const isDone = completed.includes(active.id);
  // Latest answers for the delayed check-clear, which runs after this render's closure is stale.
  const answersRef = useRef(answers);
  answersRef.current = answers;

  useEffect(() => {
    setIsStandalone(
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    );
  }, []);

  // Fetched only when the menu opens, never on mount.
  useEffect(() => {
    if (menuOpen) void loadLeaderboard();
  }, [menuOpen, loadLeaderboard]);

  // The theme class is set before paint by the script in layout.tsx (saved choice, else system).
  // Mirror it here, and keep following the system until the user picks one.
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => {
      try {
        if (localStorage.getItem("theme")) return;
      } catch {}
      document.documentElement.classList.toggle("dark", e.matches);
      setDark(e.matches);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    const root = document.documentElement;
    root.classList.add("theme-switching");
    root.classList.toggle("dark", next);
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("theme-switching")));
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
  }

  useEffect(() => {
    // Puzzle change or unmount: drop any pending check-clear so it can't hit the wrong grid.
    return () => {
      if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
      checkTimerRef.current = null;
    };
  }, [active.id]);

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
  
  function firstEmptyCell(clue: Clue) {
    const cells = getWordCells(active, clue);
    return cells.find(c => !answers[keyFor(c.row, c.col)]) ?? cells[0];
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
    if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
    checkTimerRef.current = null;
    setActive(puzzle);
    setView("play");
    setModal(false);
    setWrongCells(new Set());
    
    const first = allCells(puzzle)[0];
    if (first) {
      setCursor({ row: first.row, col: first.col });
      setDirection("across");
    }
    
    const done = await loadPuzzleProgress(puzzle);
    // Finished elsewhere since the list loaded: record it so the timer stays frozen.
    if (done) setCompleted((items) => (items.includes(puzzle.id) ? items : [...items, puzzle.id]));
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
    if (wrongCells.has(keyFor(row, col))) {
      setWrongCells((prev) => {
        const newSet = new Set(prev);
        newSet.delete(keyFor(row, col));
        return newSet;
      });
    }
    inputRef.current?.focus();
  }

  // Typing during a check's red flash cancels the pending clear: the user is already fixing it.
  function cancelPendingCheck() {
    if (!checkTimerRef.current) return;
    clearTimeout(checkTimerRef.current);
    checkTimerRef.current = null;
    setWrongCells(new Set());
  }

  function setLetter(letter: string) {
    const cell = active.grid[cursor.row][cursor.col];
    if (!cell || cell.isBlocked) return;
    cancelPendingCheck();
    const currentKey = keyFor(cursor.row, cursor.col);
    const wasFilled = !!answers[currentKey];
    const next = { ...answers, [currentKey]: letter.toUpperCase() };
    setAnswers(next);

    setWrongCells((prev) => {
      if (!prev.has(currentKey)) return prev;
      const newSet = new Set(prev);
      newSet.delete(currentKey);
      return newSet;
    });

    // Fresh letter: jump to the next empty cell later in the word. Overwriting a letter,
    // or no empty cell ahead: step one cell. At the end of the word, stay put.
    const index = wordCells.findIndex((c) => c.row === cursor.row && c.col === cursor.col);
    const ahead = wordCells.slice(index + 1);
    const nextCell =
      (!wasFilled && ahead.find((c) => !next[keyFor(c.row, c.col)])) || ahead[0];
    if (nextCell) setCursor({ row: nextCell.row, col: nextCell.col });

    if (
      allCells(active).every((c) => next[keyFor(c.row, c.col)] === c.letter)
    ) {
      setCompleted((items) => [...new Set([...items, active.id])]);
      setModal(true);
      saveProgress(next, true);
    } else saveProgress(next, isDone);
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
      cancelPendingCheck();
      // Clear the current cell, or if it's already empty, step back and clear that one.
      let target = keyFor(cursor.row, cursor.col);
      if (!answers[target]) {
        const index = wordCells.findIndex(
          (c) => c.row === cursor.row && c.col === cursor.col,
        );
        const previous = wordCells[index - 1];
        if (!previous) return;
        setCursor({ row: previous.row, col: previous.col });
        target = keyFor(previous.row, previous.col);
      }
      if (!answers[target]) return; // nothing to delete, nothing to save
      const next = { ...answers, [target]: "" };
      setAnswers(next);
      saveProgress(next, isDone);
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
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMsg(""), 2500);
  }

  // Wrong letters flash red with the letter still visible, then clear after 800ms.
  function checkCells(cells: { row: number; col: number }[], scope: "Word" | "Grid") {
    cancelPendingCheck();
    const filled = cells.filter((c) => answers[keyFor(c.row, c.col)]);
    const wrongs = new Set(
      filled
        .filter((c) => answers[keyFor(c.row, c.col)] !== active.grid[c.row][c.col].letter)
        .map((c) => keyFor(c.row, c.col)),
    );

    if (wrongs.size === 0) {
      if (!filled.length) showToast("Nothing to check yet.");
      else if (filled.length === cells.length) showToast(`${scope} is correct!`);
      else showToast("No mistakes so far.");
      return;
    }

    setWrongCells(wrongs);
    showToast(wrongs.size === 1 ? "1 letter isn't right." : `${wrongs.size} letters aren't right.`);
    const done = isDone;
    checkTimerRef.current = window.setTimeout(() => {
      checkTimerRef.current = null;
      const cleared = { ...answersRef.current };
      wrongs.forEach((k) => {
        cleared[k] = "";
      });
      setAnswers(cleared);
      setWrongCells(new Set());
      saveProgress(cleared, done);
    }, 800);
  }

  function checkWord() {
    checkCells(wordCells, "Word");
  }

  function checkGrid() {
    checkCells(allCells(active), "Grid");
  }

  function handleNextClue() {
    const allClues = [...active.clues.across, ...active.clues.down].sort((a, b) =>
      a.number !== b.number ? a.number - b.number : a.direction === "across" ? -1 : 1
    );
    if (!activeClue) return;
    const idx = allClues.findIndex(c => c.number === activeClue.number && c.direction === activeClue.direction);
    const nextClue = allClues[(idx + 1) % allClues.length];
    const cell = firstEmptyCell(nextClue);
    if (cell) {
      setCursor({ row: cell.row, col: cell.col });
      setDirection(nextClue.direction);
      inputRef.current?.focus();
    }
  }

  function handlePrevClue() {
    const allClues = [...active.clues.across, ...active.clues.down].sort((a, b) =>
      a.number !== b.number ? a.number - b.number : a.direction === "across" ? -1 : 1
    );
    if (!activeClue) return;
    const idx = allClues.findIndex(c => c.number === activeClue.number && c.direction === activeClue.direction);
    const prevClue = allClues[(idx - 1 + allClues.length) % allClues.length];
    const cell = firstEmptyCell(prevClue);
    if (cell) {
      setCursor({ row: cell.row, col: cell.col });
      setDirection(prevClue.direction);
      inputRef.current?.focus();
    }
  }

  if (!authChecked) return <LoadingScreen />;
  if (!user) return <AuthScreen supabase={supabase} />;
  if (!profileReady) return <ProfileScreen onSave={saveProfile} />;
  if (puzzleLoading) return <LoadingScreen />;

  // Nothing to show at all: full-screen error. A failed refresh while puzzles are
  // already on screen is handled by the inline notice in the home/browse view instead.
  if (error && !puzzles.length)
    return (
      <main className="auth-shell">
        <div className="auth-card">
          <span className="grid size-14 place-items-center rounded-2xl bg-family-tint text-family-ink">
            <CloudOff size={24} />
          </span>
          <h1 className="mt-6">Couldn&apos;t load your puzzles.</h1>
          <p className="mt-3 text-[15px] leading-6 text-muted-foreground">
            Check your connection and try again. Your progress is saved.
          </p>
          <button
            className="primary-button mt-6 w-full"
            onClick={() => void refetch()}
            disabled={refreshing}
          >
            {refreshing ? <Loader2 className="animate-spin" size={16} /> : <RotateCw size={16} />}
            {refreshing ? "Trying again…" : "Try again"}
          </button>
        </div>
      </main>
    );

  if (!puzzles.length)
    return (
      <main className="auth-shell">
        <div className="auth-card">
          <BrandMark className="brand-mark large" />
          <h1 className="mt-6">Your collection is getting ready</h1>
          <p className="mt-3 text-[15px] leading-6 text-muted-foreground">
            No puzzles have been added yet.
          </p>
          <button
            className="secondary-button mt-6 w-full"
            onClick={() => void refetch()}
            disabled={refreshing}
          >
            {refreshing ? <Loader2 className="animate-spin" size={16} /> : <RotateCw size={16} />}
            {refreshing ? "Checking…" : "Refresh"}
          </button>
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
          activeClue={activeClue}
          wordCells={wordCells}
          time={time}
          inputRef={inputRef}
          onKey={handleKey}
          onCell={focusCell}
          onClue={(clue: Clue) => {
            const cell = firstEmptyCell(clue);
            if (cell) setCursor({ row: cell.row, col: cell.col });
            setDirection(clue.direction);
            inputRef.current?.focus();
          }}
          onBack={() => {
            setModal(false);
            setView("home");
          }}
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
          <div role="status" key={toastMsg} className="toast">
            {toastMsg}
          </div>
        )}
        {updateReady && <UpdateBanner onReload={applyUpdate} />}
      </div>
    );

  return (
    <main className="min-h-screen bg-background text-foreground pb-safe">
      <PullIndicator pull={pull} refreshing={pullRefreshing} />
      <AppHeader
        name={name}
        email={user?.email}
        dark={dark}
        onToggleTheme={toggleTheme}
        menuOpen={menuOpen}
        onMenuOpenChange={setMenuOpen}
        leaderboard={{ rows: leaderboardRows, loading: leaderboardLoading, error: leaderboardError }}
        refreshing={pullRefreshing}
        onRefresh={() => void pullRefresh()}
        onSignOut={() => void supabase.auth.signOut()}
        onHome={() => setView("home")}
      />

      {error && (
        <div role="alert" className="refresh-notice">
          <CloudOff size={18} />
          <p className="text-sm">Couldn&apos;t refresh. Showing your puzzles from earlier.</p>
          <button className="browse-link" onClick={() => void refetch()} disabled={refreshing}>
            {refreshing ? "Trying…" : "Try again"}
          </button>
        </div>
      )}

      {view === "browse" ? (
        <BrowseScreen
          puzzles={puzzles}
          completed={completed}
          onOpen={openPuzzle}
          onHome={() => setView("home")}
        />
      ) : (
        <HomeScreen
          puzzles={puzzles}
          completed={completed}
          nextPuzzle={nextPuzzle}
          isStandalone={isStandalone}
          onOpen={openPuzzle}
          onBrowse={() => setView("browse")}
        />
      )}
      {updateReady && <UpdateBanner onReload={applyUpdate} />}
    </main>
  );
}
