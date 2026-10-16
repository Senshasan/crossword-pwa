import { ArrowDown, Loader2 } from "lucide-react";
import { PULL_THRESHOLD } from "@/hooks/usePullToRefresh";
import { de } from "@/lib/strings";

export function PullIndicator({ pull, refreshing }: { pull: number; refreshing: boolean }) {
  const offset = refreshing ? PULL_THRESHOLD : pull;
  const progress = Math.min(1, offset / PULL_THRESHOLD);
  const ready = refreshing || pull >= PULL_THRESHOLD;

  return (
    <div
      className="pull-indicator"
      data-dragging={!refreshing && pull > 0 ? "" : undefined}
      style={{ transform: `translate(-50%, ${offset - 52}px)`, opacity: progress }}
      aria-hidden={!refreshing}
    >
      {refreshing ? (
        <>
          <Loader2 className="pull-spinner" size={18} />
          {/* Reduced motion: no spinning, words instead. */}
          <span className="pull-static-text">{de.app.pullRefreshing}</span>
          <span className="sr-only" role="status">{de.app.pullRefreshingSr}</span>
        </>
      ) : (
        <ArrowDown
          size={18}
          style={{ transform: `rotate(${ready ? 180 : 0}deg)` }}
          className="pull-arrow"
        />
      )}
    </div>
  );
}
