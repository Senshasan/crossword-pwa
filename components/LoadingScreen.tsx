import { BrandMark } from "@/components/BrandMark";
import { de } from "@/lib/strings";

// No card: a quiet mark and one line, so a fast load is barely noticed.
export function LoadingScreen() {
  return (
    <main className="auth-shell">
      <div className="flex flex-col items-center gap-4" role="status">
        <BrandMark className="brand-mark large loading-mark" />
        <p className="text-sm text-muted-foreground">{de.app.loadingCollection}</p>
      </div>
    </main>
  );
}
