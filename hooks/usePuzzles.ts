import { useCallback, useEffect, useRef, useState } from "react";
import type { createClient } from "@/lib/supabase/client";
import { type PuzzleData, type PuzzleRow, mapPuzzle } from "@/lib/crossword";

export function usePuzzles(supabase: ReturnType<typeof createClient>, userId: string | undefined) {
  const [puzzles, setPuzzles] = useState<PuzzleData[]>([]);
  const [completed, setCompleted] = useState<string[]>([]);
  // puzzleLoading drives the full-screen loader (first load per user only);
  // refreshing is for manual refetches, which keep the current screen up.
  const [puzzleLoading, setPuzzleLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // True when the latest *puzzles* query failed. A failed progress query alone isn't fatal.
  const [error, setError] = useState(false);
  // Only the newest request may write state, so a slow response can't overwrite a newer one.
  const requestId = useRef(0);

  const load = useCallback(
    async (initial: boolean) => {
      const id = ++requestId.current;
      if (!userId) {
        setPuzzleLoading(false);
        return;
      }

      if (initial) {
        setPuzzleLoading(true);
        setPuzzles([]);
        setCompleted([]);
      } else {
        setRefreshing(true);
      }

      const [progressResponse, puzzlesResponse] = await Promise.all([
        supabase.from("puzzle_progress").select("puzzle_id, completed").eq("user_id", userId),
        supabase
          .from("puzzles")
          .select("id,title,puzzle_type,order_index,width,height,grid,clues,author_name,congrats_message")
          .order("order_index"),
      ]);

      if (id !== requestId.current) return;

      if (progressResponse.error) {
        console.error("[usePuzzles] puzzle_progress query failed:", progressResponse.error);
      } else {
        setCompleted(
          (progressResponse.data as { puzzle_id: string; completed: boolean }[])
            .filter((row) => row.completed)
            .map((row) => row.puzzle_id),
        );
      }

      if (puzzlesResponse.error) {
        console.error("[usePuzzles] puzzles query failed:", puzzlesResponse.error);
        setError(true);
      } else {
        setError(false);
        setPuzzles(
          (puzzlesResponse.data as PuzzleRow[])
            .map(mapPuzzle)
            .filter((puzzle): puzzle is PuzzleData => puzzle !== null),
        );
      }

      setPuzzleLoading(false);
      setRefreshing(false);
    },
    [supabase, userId],
  );

  useEffect(() => {
    void load(true);
    // Invalidate any in-flight request when the user changes or the component unmounts.
    return () => {
      requestId.current++;
    };
  }, [load]);

  const refetch = useCallback(() => load(false), [load]);

  return { puzzles, puzzleLoading, refreshing, error, completed, setCompleted, refetch };
}
