import { de } from "@/lib/strings";

export function UpdateBanner({ onReload }: { onReload: () => void }) {
  return (
    <div
      role="status"
      className="fixed inset-x-4 z-50 mx-auto flex max-w-md items-center justify-between gap-4 rounded-lg bg-foreground px-4 py-3 text-sm font-medium text-background shadow-lg"
      style={{ bottom: "calc(1rem + env(safe-area-inset-bottom))" }}
    >
      <span>{de.app.updateReady}</span>
      <button
        type="button"
        onClick={onReload}
        className="shrink-0 rounded-md bg-background px-3 py-1.5 font-semibold text-foreground"
      >
        {de.app.updateReload}
      </button>
    </div>
  );
}
