import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { createClient } from "@/lib/supabase/client";
import { type PuzzleData } from "@/lib/crossword";

const keyFor = (row: number, col: number) => `${row}:${col}`;

export function answersFromState(puzzle: PuzzleData, cellState: string[]) {
  return puzzle.grid
    .flat()
    .reduce<Record<string, string>>((result, cell, index) => {
      if (!cell.isBlocked && cellState[index])
        result[keyFor(cell.row, cell.col)] = cellState[index];
      return result;
    }, {});
}

export function cellStateFor(puzzle: PuzzleData, answers: Record<string, string>) {
  return puzzle.grid
    .flat()
    .map((cell) =>
      cell.isBlocked ? "#" : (answers[keyFor(cell.row, cell.col)] ?? ""),
    );
}

export function usePuzzleProgress(
  supabase: ReturnType<typeof createClient>,
  user: User | null,
  active: PuzzleData,
  view: "home" | "browse" | "play",
  modal: boolean
) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [seconds, setSeconds] = useState(0);
  
  const lastKnownUpdatedAt = useRef<string | null>(null);
  const saveTimer = useRef<number | null>(null);
  const pendingSave = useRef<{
    state: Record<string, string>;
    done: boolean;
    puzzleId: string;
  } | null>(null);
  const secondsRef = useRef(0);

  useEffect(() => {
    if (view !== "play" || modal) return;
    const timer = window.setInterval(() => {
      setSeconds((s) => {
        secondsRef.current = s + 1;
        return s + 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [view, modal]);

  async function flushProgress() {
    const pending = pendingSave.current;
    if (!user || !pending || pending.puzzleId !== active.id) return;
    pendingSave.current = null;
    
    const cellState = cellStateFor(active, pending.state);
    const now = new Date().toISOString();
    
    // NEW-4: Always persist secondsRef.current, not only on completion
    const solve_time_seconds = secondsRef.current;
    
    let query = supabase
      .from("puzzle_progress")
      .update({
        cell_state: cellState,
        completed: pending.done,
        solve_time_seconds,
        completed_at: pending.done ? now : null,
        updated_at: now,
      })
      .eq("user_id", user.id)
      .eq("puzzle_id", active.id);
      
    if (lastKnownUpdatedAt.current)
      query = query.eq("updated_at", lastKnownUpdatedAt.current);
      
    const { data, error } = await query.select("updated_at").maybeSingle();
    
    if (error) {
      pendingSave.current = pending;
      return;
    }
    
    if (data) {
      lastKnownUpdatedAt.current = data.updated_at;
      return;
    }
    
    const { data: server } = await supabase
      .from("puzzle_progress")
      .select("cell_state,updated_at")
      .eq("user_id", user.id)
      .eq("puzzle_id", active.id)
      .maybeSingle();
      
    if (server) {
      lastKnownUpdatedAt.current = server.updated_at;
      setAnswers(answersFromState(active, server.cell_state ?? []));
      return;
    }
    
    const { data: inserted } = await supabase
      .from("puzzle_progress")
      .insert({
        user_id: user.id,
        puzzle_id: active.id,
        cell_state: cellState,
        completed: pending.done,
        solve_time_seconds,
        completed_at: pending.done ? now : null,
        updated_at: now,
      })
      .select("updated_at")
      .single();
      
    if (inserted) lastKnownUpdatedAt.current = inserted.updated_at;
    else pendingSave.current = pending;
  }

  function saveProgress(state: Record<string, string>, done: boolean) {
    if (!user || !active.id) return;
    pendingSave.current = { state, done, puzzleId: active.id };
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(
      () => {
        void flushProgress();
      },
      done ? 0 : 2500,
    );
  }

  useEffect(() => {
    const flush = () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      void flushProgress();
    };
    
    // NEW-5 (Listener leak): Name handler and remove it properly
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };

    window.addEventListener("online", flush);
    document.addEventListener("visibilitychange", handleVisibility);
    
    return () => {
      window.removeEventListener("online", flush);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      flush();
    };
  }, [user, active.id]);

  async function loadPuzzleProgress(puzzle: PuzzleData) {
    setAnswers({});
    setSeconds(0);
    secondsRef.current = 0;
    lastKnownUpdatedAt.current = null;

    if (user) {
      const { data } = await supabase
        .from("puzzle_progress")
        .select("cell_state,completed,solve_time_seconds,updated_at")
        .eq("user_id", user.id)
        .eq("puzzle_id", puzzle.id)
        .maybeSingle();
        
      if (data) {
        lastKnownUpdatedAt.current = data.updated_at;
        setAnswers(answersFromState(puzzle, data.cell_state ?? []));
        setSeconds(data.solve_time_seconds ?? 0);
        secondsRef.current = data.solve_time_seconds ?? 0;
      }
    }
  }

  function resetProgress() {
    setAnswers({});
    setSeconds(0);
    secondsRef.current = 0;
    saveProgress({}, false);
  }

  return {
    answers,
    setAnswers,
    seconds,
    secondsRef,
    saveProgress,
    loadPuzzleProgress,
    resetProgress
  };
}
