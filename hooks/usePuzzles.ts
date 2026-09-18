import { useEffect, useState } from "react";
import type { createClient } from "@/lib/supabase/client";
import { type PuzzleData, type PuzzleRow, mapPuzzle } from "@/lib/crossword";

export function usePuzzles(supabase: ReturnType<typeof createClient>, userId: string | undefined) {
  const [puzzles, setPuzzles] = useState<PuzzleData[]>([]);
  const [puzzleLoading, setPuzzleLoading] = useState(true);
  const [completed, setCompleted] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      if (!userId) {
        if (mounted) setPuzzleLoading(false);
        return;
      }

      setPuzzleLoading(true);

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

      if (progressResponse.data) {
        setCompleted(
          progressResponse.data
            .filter((row: any) => row.completed)
            .map((row: any) => row.puzzle_id)
        );
      }

      if (puzzlesResponse.data) {
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
  }, [supabase, userId]);

  return { puzzles, puzzleLoading, completed, setCompleted };
}
