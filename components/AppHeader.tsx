import { useEffect } from "react";
import { LogOut, Moon, RotateCw, Sun } from "lucide-react";
import { LeaderboardPodium, type LeaderboardRow } from "@/components/LeaderboardPodium";
import { BrandMark } from "@/components/BrandMark";

export function AppHeader({
  name,
  email,
  dark,
  onToggleTheme,
  menuOpen,
  onMenuOpenChange,
  leaderboard,
  refreshing,
  onRefresh,
  onSignOut,
  onHome,
}: {
  name: string;
  email: string | undefined;
  dark: boolean;
  onToggleTheme: () => void;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  leaderboard: { rows: LeaderboardRow[]; loading: boolean; error: boolean };
  refreshing: boolean;
  onRefresh: () => void;
  onSignOut: () => void;
  onHome: () => void;
}) {
  // Close the menu on an outside tap or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const handleDown = (e: PointerEvent) => {
      if (!(e.target as Element).closest(".account-popover-container")) onMenuOpenChange(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onMenuOpenChange(false);
    };
    document.addEventListener("pointerdown", handleDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handleDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [menuOpen, onMenuOpenChange]);

  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8 pt-safe">
      <button className="flex items-center gap-3 rounded-xl" onClick={onHome} aria-label="Across & Along, home">
        <BrandMark />
        <span className="wordmark">Across &amp; Along</span>
      </button>
      <div className="flex items-center gap-2">
        <button
          className="icon-button"
          onClick={onToggleTheme}
          aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
        >
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <div className="relative account-popover-container">
          <button
            className="avatar"
            onClick={() => onMenuOpenChange(!menuOpen)}
            aria-label="Account"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            {name.slice(0, 2).toUpperCase()}
          </button>
          {menuOpen && (
            <div className="account-menu">
              <div className="px-1 pb-3 border-b border-border">
                <p className="font-semibold">{name}</p>
                <p className="text-sm text-muted-foreground truncate">{email}</p>
              </div>

              <div className="py-3 border-b border-border">
                <LeaderboardPodium {...leaderboard} />
              </div>

              <button
                className="secondary-button w-full mt-1"
                onClick={() => {
                  onMenuOpenChange(false);
                  onRefresh();
                }}
                disabled={refreshing}
              >
                <RotateCw size={16} /> Refresh
              </button>
              <button
                className="quiet-button w-full"
                onClick={() => {
                  onMenuOpenChange(false);
                  onSignOut();
                }}
              >
                <LogOut size={16} /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
