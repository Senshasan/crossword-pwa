import { Trophy } from "lucide-react";

export type LeaderboardRow = {
  display_name: string;
  completed_count: number;
  is_me: boolean;
};

// Visual order is 2nd | 1st | 3rd, so we map rank -> column explicitly.
const SLOT = [
  { rank: 2, idx: 1, height: "h-20", order: "order-1" },
  { rank: 1, idx: 0, height: "h-28", order: "order-2" },
  { rank: 3, idx: 2, height: "h-14", order: "order-3" },
];

export function LeaderboardPodium({
  rows,
  loading,
  error,
}: {
  rows: LeaderboardRow[];
  loading: boolean;
  error: boolean;
}) {
  if (loading) return <p className="text-sm text-muted-foreground py-3">Loading…</p>;
  if (error)
    return <p className="text-sm text-muted-foreground py-3">Couldn&apos;t load the leaderboard.</p>;
  if (!rows.length)
    return <p className="text-sm text-muted-foreground py-3">Nobody has finished a puzzle yet.</p>;

  return (
    <div>
      <p className="eyebrow flex items-center gap-2 mb-3">
        <Trophy size={14} /> Puzzles solved
      </p>
      <div className="flex items-end justify-center gap-2">
        {SLOT.map(({ rank, idx, height, order }) => {
          const row = rows[idx];
          if (!row) return <div key={rank} className={`${order} w-20`} />;
          return (
            <div key={rank} className={`${order} flex w-20 flex-col items-center`}>
              <span className="mb-1 max-w-full truncate text-xs font-semibold">
                {row.display_name}
                {row.is_me && <span className="text-muted-foreground"> (you)</span>}
              </span>
              <div
                className={`${height} flex w-full items-start justify-center rounded-t-lg border border-border pt-2 ${
                  rank === 1 ? "bg-primary text-primary-foreground" : "bg-secondary"
                }`}
              >
                <span className="text-lg font-semibold leading-none">{row.completed_count}</span>
              </div>
              <span className="w-full rounded-b-sm bg-muted py-0.5 text-center text-[10px] font-semibold text-muted-foreground">
                #{rank}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
