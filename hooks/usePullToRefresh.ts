import { useCallback, useEffect, useRef, useState } from "react";

export const PULL_THRESHOLD = 70;
const MAX_PULL = 110;
const RESISTANCE = 0.5;

// Hand-rolled pull-to-refresh for the installed iOS app, which has no browser reload.
// `pull` is the resisted drag distance in px (0 when idle), capped at MAX_PULL.
export function usePullToRefresh(onRefresh: () => Promise<void>, enabled: boolean) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  // Also used by the account menu's Refresh item, so both paths share the in-flight guard.
  const refresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    try {
      await onRefreshRef.current();
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
      setPull(0);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setPull(0);
      return;
    }

    let startX = 0;
    let startY: number | null = null;
    let tracking = false;
    let distance = 0;

    const reset = () => {
      startY = null;
      tracking = false;
      distance = 0;
    };

    const onStart = (e: TouchEvent) => {
      if (refreshingRef.current || e.touches.length !== 1 || window.scrollY > 0) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };

    const onMove = (e: TouchEvent) => {
      if (startY === null) return;
      const dy = e.touches[0].clientY - startY;
      const dx = e.touches[0].clientX - startX;
      if (!tracking) {
        // Only a downward, mostly vertical drag from the very top counts; anything else is a scroll.
        if (dy <= 0 || Math.abs(dx) > dy || window.scrollY > 0) {
          reset();
          return;
        }
        tracking = true;
      }
      distance = Math.min(MAX_PULL, Math.max(0, dy * RESISTANCE));
      setPull(distance);
      // Stop Safari's rubber-band from moving the page under the indicator.
      if (e.cancelable) e.preventDefault();
    };

    const onEnd = () => {
      const triggered = tracking && distance >= PULL_THRESHOLD;
      reset();
      if (triggered) {
        setPull(PULL_THRESHOLD);
        void refresh();
      } else {
        setPull(0);
      }
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    // Not passive: onMove may call preventDefault.
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onEnd);
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, [enabled, refresh]);

  return { pull, refreshing, refresh };
}
