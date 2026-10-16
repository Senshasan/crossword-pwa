import { useCallback, useState } from "react";
import type { createClient } from "@/lib/supabase/client";
import type { LeaderboardRow } from "@/components/LeaderboardPodium";

export function useLeaderboard(supabase: ReturnType<typeof createClient>) {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  // Call when the account menu opens — not on mount, so it costs nothing until looked at.
  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    const { data, error } = await supabase.rpc("get_leaderboard", { limit_count: 3 });
    if (error) {
      console.error("[leaderboard]", error);
      setError(true);
    } else {
      setRows((data ?? []).map((r: any) => ({ ...r, completed_count: Number(r.completed_count) })));
    }
    setLoading(false);
  }, [supabase]);

  return { rows, loading, error, load };
}
