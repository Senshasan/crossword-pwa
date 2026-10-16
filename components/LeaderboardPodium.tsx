import { Trophy } from "lucide-react";
import { de } from "@/lib/strings";

const t = de.leaderboard;

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
  if (loading) return <p className="text-sm text-muted-foreground py-3">{de.common.loading}</p>;
  if (error)
    return <p className="text-sm text-muted-foreground py-3">{t.failed}</p>;
  if (!rows.length)
    return <p className="text-sm text-muted-foreground py-3">{t.empty}</p>;

  return (
    <div>
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Trophy size={15} className="text-brand-ink" /> {t.title}
      </p>
      <div className="flex items-end justify-center gap-2">
        {SLOT.map(({ rank, idx, height, order }) => {
          const row = rows[idx];
          if (!row) return <div key={rank} className={`${order} w-20`} />;
          return (
            <div key={rank} className={`${order} flex w-20 flex-col items-center`}>
              {/* "(du)" on its own line so truncating a long name can't hide it. */}
              <span className="mb-1 flex max-w-full flex-col items-center text-xs font-semibold leading-tight">
                <span className="max-w-full truncate" title={row.display_name}>
                  {row.display_name}
                </span>
                {row.is_me && <span className="font-normal text-muted-foreground">{t.you}</span>}
              </span>
              <div
                className={`${height} flex w-full items-start justify-center rounded-t-lg border border-border pt-2 ${
                  rank === 1 ? "border-transparent bg-brand-strong text-white" : "bg-secondary"
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
