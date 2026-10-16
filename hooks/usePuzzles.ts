import { useEffect, useState, useCallback } from "react";
import type { createClient } from "@/lib/supabase/client";
import { type PuzzleData, type PuzzleRow, mapPuzzle } from "@/lib/crossword";

export function usePuzzles(supabase: ReturnType<typeof createClient>, userId: string | undefined) {
  const [puzzles, setPuzzles] = useState<PuzzleData[]>([]);
  const [puzzleLoading, setPuzzleLoading] = useState(true);
  const [puzzleError, setPuzzleError] = useState<string | null>(null);
  const [completed, setCompleted] = useState<string[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const refetch = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      if (!userId) {
        if (mounted) setPuzzleLoading(false);
        return;
      }

      setPuzzleLoading(true);
      setPuzzleError(null);

      const [progressResponse, puzzlesResponse] = await Promise.all([
        supabase
          .from("puzzle_progress")
          .select("puzzle_id, completed")
          .eq("user_id", userId),
        supabase
          .from("puzzles")
          .select("id,title,puzzle_type,order_index,width,height,grid,clues,author_name,congrats_message")
          .order("order_index")
      ]);

      if (!mounted) return;

      if (progressResponse.error) {
        console.error("Error fetching progress:", progressResponse.error);
        setPuzzleError("Failed to load your progress.");
      } else if (progressResponse.data) {
        setCompleted(
          progressResponse.data
            .filter((row: any) => row.completed)
            .map((row: any) => row.puzzle_id)
        );
      }

      if (puzzlesResponse.error) {
        console.error("Error fetching puzzles:", puzzlesResponse.error);
        setPuzzleError("Failed to load puzzles. Please check your connection or database schema.");
      } else if (puzzlesResponse.data) {
        setPuzzles(
          (puzzlesResponse.data as PuzzleRow[])
            .map(mapPuzzle)
            .filter((puzzle): puzzle is PuzzleData => puzzle !== null)
        );
      }
      
      setPuzzleLoading(false);
    }

    void loadData();

    return () => {
      mounted = false;
    };
  }, [supabase, userId, refreshTrigger]);

  return { puzzles, puzzleLoading, puzzleError, completed, setCompleted, refetch };
}
