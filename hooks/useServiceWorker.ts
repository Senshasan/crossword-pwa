import { useCallback, useEffect, useState } from "react";

export function useServiceWorker() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    // Never register in dev: a caching SW fights hot reload and was part of how we got here.
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;

    let hadController = !!navigator.serviceWorker.controller;
    let reloading = false;
    const onControllerChange = () => {
      // First-ever install also fires controllerchange (clients.claim) — don't reload for that,
      // but do reload for any later update accepted in this same session.
      if (!hadController) {
        hadController = true;
        return;
      }
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    let reg: ServiceWorkerRegistration | undefined;
    const onVisible = () => {
      if (document.visibilityState === "visible") void reg?.update();
    };

    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((r) => {
        reg = r;
        if (r.waiting && navigator.serviceWorker.controller) setWaiting(r.waiting);
        r.addEventListener("updatefound", () => {
          const sw = r.installing;
          sw?.addEventListener("statechange", () => {
            if (sw.state === "installed" && navigator.serviceWorker.controller) setWaiting(sw);
          });
        });
        // iOS resumes standalone PWAs from suspension without a navigation, so the
        // browser never re-checks sw.js on its own. Check whenever the app comes to the foreground.
        document.addEventListener("visibilitychange", onVisible);
        void r.update();
      })
      .catch(() => undefined);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const applyUpdate = useCallback(() => waiting?.postMessage({ type: "SKIP_WAITING" }), [waiting]);
  const checkForUpdate = useCallback(async () => {
    const r = await navigator.serviceWorker?.getRegistration();
    await r?.update();
  }, []);

  return { updateReady: !!waiting, applyUpdate, checkForUpdate };
}
