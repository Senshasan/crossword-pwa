# Across & Along — Project Status

Last updated: 2026-10-16 (after Round 3 and the design pass). The latest commit at the time of writing is `c59f4c5`.

Read this first in a new session. `CLAUDE.md` in the repo root holds the standing architecture notes and rules. This file records **what has been done, what state things are in, and what is still open**. Treat the code as the source of truth if the two disagree.

---

## 1. What the project is

A private, ad-free crossword PWA made as a birthday gift for a friend, played by that friend and their family and friends. Most players install it on iPhones through Safari → Share → Add to Home Screen.

- **Stack:** Next.js 16 (App Router, `proxy.ts` in place of middleware), TypeScript, Tailwind v4, Supabase (Postgres plus email one-time-code sign-in), deployed on Vercel from `main`.
- **Repo:** https://github.com/Senshasan/crossword-pwa. Commits currently go straight to `main`.
- **Two kinds of puzzle:** `standard` and `custom` ("From the family", written by family members, with an optional `author_name` and `congrats_message`).
- **Content:** puzzles are entered by hand in Supabase. The app has no puzzle editor.

---

## 2. Where things stand

| Area | State |
|---|---|
| Round 3 plan (`docs/implementation-plan.md`, Phases 1–7) | **Done and committed** |
| Backspace not saving | **Fixed** (`b38e7d1`) |
| Leaderboard migration replay (`DROP FUNCTION` before recreate) | **Fixed** by the user in the migration file |
| UI and design overhaul | **Done and committed** (`406d0f7`, `c59f4c5`) |
| Phone verification of all of the above | **Pending** (see §6) |
| Real puzzle content | **Not started.** This is the main remaining task |

---

## 3. Work log

### Round 3 phases (from `docs/implementation-plan.md`)

1. **Service worker versioning and update banner.**
   - `sw-src/sw.js` is the template. `scripts/stamp-sw.mjs` writes the gitignored `public/sw.js` on every `dev`/`build`, with the cache name `across-along-<id>`.
   - Page loads are network-first, and the worker never calls `skipWaiting()` on install.
   - `hooks/useServiceWorker.ts` and `components/UpdateBanner.tsx` show a "new version" bar, and the update applies when the user taps Reload.
   - Two changes to the drop-in files: the build id gets a timestamp suffix when the working tree has uncommitted changes, and an update accepted in the same session as the first install now reloads the page.
2. **Data layer.** `usePuzzles` now separates a failed load (a full error screen, or an inline notice if puzzles are already showing) from a genuinely empty collection. `refetch()` keeps the current screen up instead of showing the full-screen loader. The migration `20261016000000_leaderboard_and_first_clear.sql` was copied into the repo.
3. **Mobile layout.** Browse shows every puzzle; safe areas are handled (`.pt-safe`, `.pb-safe`, `viewport-fit=cover`); the install hint is hidden in the installed app; the manifest icons are fixed.
4. **Gameplay.**
   - Selecting a clue puts the cursor on its first empty cell, and typing skips cells that are already filled.
   - Wrong letters flash red while still visible, then clear after 800 ms.
   - The client never saves `completed: false` for a solved puzzle.
   - The timer stays frozen on finished puzzles, including ones finished on another device.
5. **Pull-to-refresh.** Hand-written in `hooks/usePullToRefresh.ts` and `components/PullIndicator.tsx`. It works on Home and Browse only. It reloads the puzzles and checks for an app update, and the account menu also has a Refresh item.
6. **Leaderboard.** `components/LeaderboardPodium.tsx` and `hooks/useLeaderboard.ts` sit in the account menu. They use only the `get_leaderboard` RPC and show the top 3 names, with "(you)" on the signed-in user.
7. **Cleanup.** Removed unused `PlayScreen` props, moved `shadcn` to devDependencies, added `scripts/validate-puzzles.mjs`, and added `docs/puzzle_test/README.md`.

### After the plan

- **Backspace:** now saves the deletion through the usual 2.5-second delayed save.
- **Design pass:**
  - **Bugs fixed:**
    - Puzzle thumbnails showed answer letters. They now show only the block pattern.
    - The active-clue bar layout was broken, and on a phone the bar was hidden behind the keyboard. It now sits directly above the grid and stays in view.
    - Dark mode was forced on everyone. The app now follows the system setting and remembers a manual choice.
    - Reset wiped the grid in one tap. It now needs a second tap.
    - Some text colours were below accessible contrast.
  - **Visuals:**
    - Fonts: Newsreader for headings and clues, Schibsted Grotesk for the interface and grid letters.
    - Semantic light and dark colour tokens.
    - Clues split into Across and Down.
    - A consistent category label everywhere ("Standard" / "From <author>").
    - A new solved screen that shows the family author's note.
    - Browse filters with an "X of N solved" count.
    - A new brand mark and app icons, replacing the v0 logo.
  - **Code structure:** the home, browse and header markup moved out of `page.tsx` into `HomeScreen`, `BrowseScreen` and `AppHeader`. Unused v0 placeholder files were removed from `public/`.

---

## 4. Key facts a future session needs

- **Database rules:**
  - The `keep_first_clear` trigger makes a first solve permanent: once `completed` is true, it can't be set back, and `completed_at` / `solve_time_seconds` can't change.
  - It deliberately leaves `updated_at` alone, because the client uses `updated_at` to detect conflicting saves from two devices.
  - Never add a trigger that sets `updated_at` automatically.
- **Migrations are applied by hand** in the Supabase dashboard. Only ever *add* migration files, and never run or edit one that has been applied. The live database has all four migrations in `supabase/migrations/` applied.
- **Puzzle rows that fail validation are silently left out of the app** (`mapPuzzle` → `validatePuzzleData` in `lib/crossword.ts`, which only logs a `console.warn`). Check them before inserting:
  ```
  node scripts/validate-puzzles.mjs <file.json>
  ```
  The script needs Node 22.18 or later. Node prints a harmless `MODULE_TYPELESS_PACKAGE_JSON` warning. The script exits with code 1 if any puzzle fails.
- **Puzzle row format:**
  - `grid` is a flat array of `width*height` single letters, with `"#"` for a blocked cell.
  - `clues` is `{ "across": [...], "down": [...] }`, and each clue has `{ number, text, answer, row, col }`.
  - Clue numbers must follow standard crossword numbering.
  - The JSON files in `docs/puzzle_test/` use an older, incompatible format and are kept only as an archive.
- **Service worker:** edit `sw-src/sw.js`, never `public/sw.js`. The worker is not registered under `pnpm dev`, so test it with `pnpm build && pnpm start`.
- **Theme:** an inline script in `app/layout.tsx` sets the `.dark` class before first paint (saved choice in `localStorage.theme`, else the system setting).
- **Icons:** `components/BrandMark.tsx` and `public/icon.svg` are the same drawing. The PNGs (`apple-icon.png` 180, `icon-192.png`, `icon-512.png`) were rendered from it. If the mark changes, regenerate all of them.
- **Sign-in email:** the Supabase sign-in email template must include `{{ .Token }}` so users get a typed 6-digit code. This is a dashboard setting, not code.
- **`CLAUDE.md` tail:** `next dev` automatically adds a "This is NOT the Next.js you know" block to the end of `CLAUDE.md`. Leave it in place.
- **Checks:** there are no tests and no linter. Run `pnpm exec tsc --noEmit` and `pnpm build` before calling anything done.

### Design-review technique (used in the design pass)
Every real screen is behind the emailed sign-in code. To see screens without signing in:
1. Add a temporary `app/preview-tmp/` route that renders the components with mock `PuzzleData`.
2. Run `next dev`.
3. Screenshot with headless Chrome (`C:/Program Files/Google/Chrome/Application/chrome.exe --headless=new --screenshot`).

Headless Chrome has a minimum window width of about 500 px. For a true 390 px phone capture, load the page inside a 390 px iframe. For dark mode, add `--force-dark-mode`. Delete the preview route and stop the server (by its PID only) afterwards.

---

## 5. Open items and ideas

- **Puzzle content (main task):** convert family members' puzzle ideas into rows, run `validate-puzzles.mjs`, then insert them. Use `order_index` to place custom puzzles at chosen points in the Continue sequence.
- **Runbook (optional):** a short "how to add a puzzle" guide for non-technical helpers.
- **`DESIGN.md` (optional):** record the visual system via `/impeccable document`, so future UI work stays consistent.
- **Minor code leftovers** (harmless):
  - `secondsRef` is returned by `usePuzzleProgress` but no longer used by the page.
  - `clueById` in `validatePuzzleData` is unused.
  - `lib/supabase/server.ts` is deliberately kept, though nothing uses it yet.
- **Not built, by design:** an in-app puzzle editor, a public submission form, and comparing solve times between players.

---

## 6. Still to verify on a phone (installed app, after deploy)

**Do first:** delete the installed app and add it to the Home Screen again (and, if needed, clear the site's data in Safari). Older installs may still hold the pre-Round-3 service worker, and iOS caches icons.

- [ ] **Updates:** a new deploy shows the "A new version is available" bar, and **Reload** applies it.
- [ ] **Layout:** the header clears the status bar on Home and inside a puzzle.
- [ ] **Browse:** every puzzle is listed.
- [ ] **Install hint:** hidden in the installed app, still shown in plain Safari.
- [ ] **Pull-to-refresh:**
  - A long pull on Home refreshes the list; a short pull or a normal scroll doesn't.
  - Pulling does nothing inside a puzzle.
  - A puzzle added in Supabase appears after a pull.
- [ ] **Typing:** with the keyboard open, the current clue stays visible above the grid.
- [ ] **Check feedback:** a wrong letter turns red with the letter still visible, then clears.
- [ ] **Completion:** a solved puzzle stays solved after Check puzzle, Reset, or reopening it, and its timer doesn't run.
- [ ] **Backspace:** deletions survive leaving and reopening the puzzle.
- [ ] **Reset:** needs a second tap ("Clear grid?").
- [ ] **Theme:** matches the phone's light/dark setting, and the toggle remembers your choice.
- [ ] **Leaderboard:** with two or more accounts, the podium order reads 2nd | 1st | 3rd, and your own column shows "(you)".
- [ ] **Icon:** the new mark appears on the home screen.
- [ ] **Errors:** with no network at sign-in, you get the "Couldn't load your puzzles." screen, and **Try again** works.

---

## 7. Document map

| File | What it is |
|---|---|
| `CLAUDE.md` | Standing architecture notes, commands and rules for any session |
| `docs/project-status.md` | This file: progress, state, open items |
| `docs/implementation-plan.md` | The Round 3 phase plan (complete) |
| `docs/drop-in/` | Reference files the plan copied from. Some were adjusted when copied; the repo versions are the real ones |
| `docs/round3-report-and-plan.md`, `bug-report.md`, `fix-verification-and-review.md`, `handoff (1).md` | Earlier review rounds. Useful background, but partly out of date |
| `docs/puzzle_test/` | Archived JSON in an old, incompatible puzzle format |
