import { Grid2X2 } from "lucide-react";

export function LoadingScreen() {
  return (
    <main className="auth-shell">
      <div className="auth-card">
        <span className="brand-mark">
          <Grid2X2 size={19} />
        </span>
        <p className="mt-5 text-sm text-muted-foreground">
          Loading your collection…
        </p>
      </div>
    </main>
  );
}
