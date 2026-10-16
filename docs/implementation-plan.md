# Implementation Plan (for the AI) — Round 3

Save as `docs/implementation-plan.md`. Work **one phase at a time**, only the phase the user names, then stop. `CLAUDE.md` in the repo root holds the standing rules. This file holds the detail.

## Context in thirty seconds

A closed family crossword PWA, installed on iPhones. Next.js 16 App Router, TypeScript, Tailwind v4, Supabase (Auth + Postgres), deployed on Vercel. One route (`app/page.tsx`, a client component) that coordinates views: `home | browse | play`. State is split across `hooks/useAuth.ts`, `hooks/usePuzzles.ts`, `hooks/usePuzzleProgress.ts`. UI components are in `components/`. Puzzle logic and validation are in `lib/crossword.ts`.

Reference files provided by the user are in `docs/drop-in/`. Copy them to their real locations as each phase says. They've been reasoned through and the stamp script was tested, so **use them verbatim** unless a phase says otherwise. If you think one is wrong, say so and explain; don't silently rewrite it.

Line numbers drift. Find code by function or class name.

## Ground rules for every phase

1. Do only the named phase. Don't "helpfully" fix things from other phases.
2. `pnpm build` must pass. Show the output.
3. No new dependencies without asking.
4. Never touch `.env*`. Never run or edit database migrations: the user applies them. You may only *add* new migration files.
5. When done: list files changed, show build output, list what the user should verify (the phase's "You verify" section), and **stop**.
6. If something in the repo contradicts this plan, stop and report it rather than guessing.

## Phase map

| # | Phase | Touches | Needs phone test? |
|---|---|---|---|
| 1 | Service worker versioning + update banner | sw, hooks, page, proxy, package.json | **Yes (after deploy)** |
| 2 | Data layer: error handling + refetch | usePuzzles, page | No |
| 3 | Mobile layout + install hint | CSS, layout, page | **Yes** |
| 4 | Gameplay: cursor, check feedback, completion, timer | page, PlayScreen, usePuzzleProgress | No |
| 5 | Pull-to-refresh | new hook + component, page | **Yes** |
| 6 | Leaderboard UI | new component + hook, page, CSS | No |
| 7 | Cleanup | misc | No |

---

# Phase 1 — Service worker versioning + update banner

**Why this matters most.** `public/sw.js` serves the HTML shell cache-first under a hardcoded cache name (`across-along-v1`), and the file never changes, so browsers never install a new worker. Installed apps are frozen on whatever build they first loaded. Everything else depends on this being fixed.

### Prompt to paste

> Do Phase 1 of `docs/implementation-plan.md`. Read the whole phase first. Use the files in `docs/drop-in/` as specified. Don't start Phase 2.

### Step 0 — Check what already exists (do this before any edit)

The user's local repo may already contain an earlier service-worker fix that was never pushed to GitHub (the project's `CLAUDE.md` mentions a `scripts/bump-sw.mjs` build step and a network-first shell). Before changing anything:

1. Run `ls scripts`, `git log --oneline -10`, and read `package.json` scripts, `public/sw.js` and `scripts/bump-sw.mjs` if they exist.
2. Compare against `docs/drop-in/sw-src/sw.js`. Report these four facts in a short table and **wait for the user's choice if they disagree with the default below**:
   - Is navigation network-first? (required)
   - Does the cache name change on every deploy, and how is it derived?
   - Does `install` call `skipWaiting()`? (must not; it makes updates reload mid-puzzle)
   - Is `public/sw.js` generated or hand-edited and tracked?
3. **Default decision:** use the drop-in mechanism (`sw-src/sw.js` template, `scripts/stamp-sw.mjs`, gitignored generated `public/sw.js`) and remove `bump-sw.mjs`, so there is exactly **one** versioning mechanism. Never leave both. If the existing worker already meets all four requirements, say so and propose keeping it, adding only what is missing (items 4 to 7 below). Update `CLAUDE.md`'s Commands and Service worker lines to match whichever you end up with.

### Tasks

1. Copy `docs/drop-in/sw-src/sw.js` → `sw-src/sw.js` and `docs/drop-in/scripts/stamp-sw.mjs` → `scripts/stamp-sw.mjs`.
2. Add to `package.json` scripts: `"predev": "node scripts/stamp-sw.mjs"` and `"prebuild": "node scripts/stamp-sw.mjs"`.
3. Add `public/sw.js` to `.gitignore`. If `public/sw.js` is currently tracked, `git rm --cached public/sw.js`. Don't delete the working file.
4. Copy `docs/drop-in/hooks/useServiceWorker.ts` → `hooks/useServiceWorker.ts`.
5. In `app/page.tsx`, find the effect that calls `navigator.serviceWorker.register(...)` and **remove it**. Use `const { updateReady, applyUpdate, checkForUpdate } = useServiceWorker();` instead.
6. Create `components/UpdateBanner.tsx`: a fixed bar at the bottom reading "A new version is available" with a **Reload** button that calls `applyUpdate`. Style it with existing tokens (`bg-foreground text-background`, rounded, shadow) and respect `env(safe-area-inset-bottom)`. Render it only when `updateReady` is true, in both the home/browse return and the play return. Not on auth or loading screens.
7. In `proxy.ts`, add `sw\\.js` and `manifest\\.json` to the matcher's excluded paths. The matcher should become:
   `'/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'`
8. Keep `checkForUpdate` available for Phase 5; don't use it yet.

### Do not
- Add `skipWaiting()` to the install handler.
- Make navigation requests cache-first.
- Hand-edit `public/sw.js`.

### Acceptance
- `pnpm build` prints `[stamp-sw] public/sw.js generated, build id = …` and passes.
- `grep -c __BUILD_ID__ public/sw.js` returns 0.
- `git status` does not show `public/sw.js` as a tracked change.
- No remaining direct `serviceWorker.register` call in `app/`.

### You verify
- `pnpm build && pnpm start`, open `localhost:3000`, DevTools → Application → Service Workers: a worker is registered, and its cache name is `across-along-<id>`.
- Make a trivial visible text change, rebuild, reload twice: the banner appears, tap Reload, the change shows.
- Then merge to `main`, let Vercel deploy, and do the **phone wipe** described in `01-your-checklist.md` Part D.

---

# Phase 2 — Data layer: errors and refetch

**Why.** If a Supabase query fails (missing column, RLS, network), the app currently shows "No puzzles have been added yet", which is the same as a genuinely empty collection. Also there is no way to re-fetch puzzles without a full reload.

### Prompt to paste

> Do Phase 2 of `docs/implementation-plan.md`. Don't start Phase 3.

### Tasks

1. `hooks/usePuzzles.ts`:
   - Read `.error` from both queries (`puzzle_progress` and `puzzles`). `console.error` each with a clear prefix.
   - Return a new `error: boolean` (true if the *puzzles* query failed).
   - Extract the loader so it can be called on demand, and return `refetch: () => Promise<void>`. The existing effect keeps calling it on `userId` change. A manual refetch should **not** flip the whole app into the full-screen loading state; add a separate `refreshing: boolean`.
2. `app/page.tsx`: when `error` is true, show a distinct state: "Couldn't load your puzzles." with a **Try again** button calling `refetch`. Keep the existing "No puzzles have been added yet" screen for the genuinely-empty case only.
3. Copy `docs/drop-in/supabase/migrations/20261016000000_leaderboard_and_first_clear.sql` → `supabase/migrations/20261016000000_leaderboard_and_first_clear.sql` (unchanged). The user has already applied it; this just records it in the repo. Do not run it.

### Acceptance
- `pnpm build` passes.
- Simulating failure (e.g. temporarily misspelling a column name in the select) shows the error state, not the empty state. **Revert that before finishing.**

### You verify
- Normal load still shows all puzzles.
- Briefly turn on airplane mode at the point of signing in on a laptop, or temporarily break the select as above, and confirm the error screen with a working retry.

---

# Phase 3 — Mobile layout + install hint

### Prompt to paste

> Do Phase 3 of `docs/implementation-plan.md`. Don't start Phase 4.

### Tasks

1. **Browse shows only 2 puzzles on phones.** In `globals.css`, the media query (`max-width: 700px`) has `.puzzle-grid .puzzle-card:nth-child(n + 3) { display: none; }`. It was meant for the home preview but also hits Browse. Give the home preview grid an extra class (`puzzle-grid preview-grid`) in `page.tsx` and scope that rule to `.preview-grid`. The Browse grid must show every puzzle.
2. **"Browse all" wraps mid-label on narrow screens.** Add `white-space: nowrap; flex-shrink: 0;` to `.browse-link`. Add `gap-4` to the two flex rows that contain a heading plus a `.browse-link` (the "Pick up where you left off" row and the "All puzzles" `.section-heading`).
3. **Content sits under the iPhone status bar.** `layout.tsx` uses `statusBarStyle: 'black-translucent'` with no safe-area handling. Add `viewportFit: 'cover'` to the `viewport` export and apply `padding-top: max(1.25rem, env(safe-area-inset-top))` to the top header(s) (home and play), plus `padding-bottom: env(safe-area-inset-bottom)` on the page container. Don't use arbitrary pixel offsets.
4. **Hide the install hint when already installed.** In `page.tsx`:
   ```ts
   const [isStandalone, setIsStandalone] = useState(true); // true by default: no flash of the hint
   useEffect(() => {
     setIsStandalone(
       window.matchMedia("(display-mode: standalone)").matches ||
         (navigator as any).standalone === true,
     );
   }, []);
   ```
   Render the "On iPhone? Use Safari's Share menu…" box only when `!isStandalone`.
5. `public/manifest.json`: the SVG icon is declared as `180x180` and iOS ignores SVG manifest icons. Generate no new art; reuse `public/apple-icon.png` and declare it correctly (`image/png`, with its real size). If its size is not 180, check with an image tool or `file` and say what you found.

### Acceptance
- `pnpm build` passes.
- In responsive mode at 390 px width: Browse lists all puzzles; both "Browse all" and "See collection" sit on one line with their chevron.

### You verify (on your phone, after merging and deploying)
- Header clears the clock and battery in the installed app.
- Browse shows every puzzle.
- The install hint is gone in the installed app and still appears in plain Safari.

---

# Phase 4 — Gameplay

### Prompt to paste

> Do Phase 4 of `docs/implementation-plan.md`. Don't start Phase 5.

### Tasks

1. **Land on the first empty cell.** Add in `page.tsx`:
   ```ts
   function firstEmptyCell(clue: Clue) {
     const cells = getWordCells(active, clue);
     return cells.find((c) => !answers[keyFor(c.row, c.col)]) ?? cells[0];
   }
   ```
   Use it when selecting via the clue list (`onClue`), `handleNextClue`, and `handlePrevClue`. A fully filled word falls back to its first cell.
2. **Skip filled cells while typing.** In `setLetter`, after writing a letter, advance to the next *empty* cell later in the word; if there is none, stay on the last cell. Handle the case where a filled cell is overwritten (the user retyping over a letter should still advance normally).
3. **Check feedback must show before clearing.** In `checkWord` and `checkGrid`: set `wrongCells` but **leave `answers` untouched**; after ~800 ms remove those wrong letters from `answers`, clear `wrongCells`, and save. Keep the timeout id in a ref; clear it on unmount, on puzzle change, and if the user starts typing. If nothing is wrong, show the existing "correct" toast.
4. **Completion must not be undone by the client.** `checkWord`, `checkGrid` and `reset` call `saveProgress(next, false)`. On a solved puzzle that writes `completed: false`. Change them to pass `completed.includes(active.id)` as the `done` flag. (A database trigger also protects this; the client should still be correct.)
5. **Freeze the timer on finished puzzles.** Add a `frozen: boolean` argument to `usePuzzleProgress`; when true, skip the interval. Pass `completed.includes(active.id)`. Also, `loadPuzzleProgress` should not make a finished puzzle's timer tick up after reopening.

### Acceptance
- `pnpm build` passes.
- Fully filled word + click its clue → cursor on the first cell. Word with gaps → cursor on the first gap.

### You verify
- Solve a puzzle. Press Check Grid. Leave and reopen. It still counts as completed (check the Home "Continue" card moves on, or look at the row in Supabase).
- Type a wrong letter, press Check Word: the cell turns red *with its letter visible*, then clears.
- Reopen a finished puzzle: the timer doesn't count up.

---

# Phase 5 — Pull-to-refresh

**Needs:** Phase 2's `refetch` and Phase 1's `checkForUpdate`.

### Prompt to paste

> Do Phase 5 of `docs/implementation-plan.md`. Hand-write it; don't add a library. Don't start Phase 6.

### Tasks

1. Create `hooks/usePullToRefresh.ts`: `usePullToRefresh(onRefresh: () => Promise<void>, enabled: boolean)` returning `{ pull, refreshing }` (`pull` = current drag distance, capped).
   - Listen for `touchstart`, `touchmove`, `touchend` on `document`.
   - Start tracking only if `window.scrollY === 0` and the touch begins on a downward drag.
   - Trigger at a pull distance ≥ 70 px; below that it springs back and does nothing.
   - Apply resistance (e.g. `distance * 0.5`) so it feels natural.
   - While `refreshing`, ignore further pulls.
2. Create `components/PullIndicator.tsx`: a small spinner/arrow that slides down from the top, using `lucide-react` icons already installed. Respect `prefers-reduced-motion` (no spin animation; show static text instead).
3. In `page.tsx`, enable it **only in the `home` and `browse` views** and **never in `play`** (dragging inside the grid must not trigger it). `onRefresh` should call `refetch()` from `usePuzzles` **and** `checkForUpdate()` from `useServiceWorker`, awaiting both.
4. `globals.css`: `overscroll-behavior-y: contain` on `html, body` so Safari's native bounce doesn't fight the handler.
5. Also add a **Refresh** item to the account menu that calls the same function, as a fallback for non-touch use.

### Acceptance
- `pnpm build` passes.
- Touch emulation: a short pull does nothing; a long pull shows the spinner and re-fetches; pulling in the play view does nothing.

### You verify (phone, installed app)
- Pull down on Home: spinner, then list refreshes.
- Add a test puzzle in Supabase, pull to refresh, and it appears without closing the app.
- Scrolling normally down the page doesn't trigger it.

---

# Phase 6 — Leaderboard UI

**Needs:** the migration from Phase 2 applied in Supabase, and at least one completed puzzle on two accounts.

### Prompt to paste

> Do Phase 6 of `docs/implementation-plan.md`. Don't start Phase 7.

### Tasks

1. Copy `docs/drop-in/components/LeaderboardPodium.tsx` → `components/LeaderboardPodium.tsx` and `docs/drop-in/hooks/useLeaderboard.ts` → `hooks/useLeaderboard.ts`, unchanged.
2. In `page.tsx`: `const { rows, loading, error, load } = useLeaderboard(supabase);` and call `load()` in an effect when `menuOpen` becomes true. Don't fetch on mount.
3. Render `<LeaderboardPodium rows={rows} loading={loading} error={error} />` inside `.account-menu`, between the name/email block and the Sign out button, with a thin divider above and below.
4. `globals.css`: widen `.account-menu` to about `280px` (`max-width: calc(100vw - 2rem)`), and make sure it stays fully on screen at 390 px (it is anchored to the right edge).
5. Add `Refresh` to the menu only if Phase 5 didn't already.

### Do not
- Query `profiles` or `puzzle_progress` from the client for this. Only the `get_leaderboard` RPC.
- Show email addresses, user ids, or solve times.
- Change the SQL function. If you think it needs changing, report it; a change would be a new migration.

### Acceptance
- `pnpm build` passes.
- Menu shows the podium with up to 3 names; the signed-in user's own row is labelled "(you)".

### You verify
- Two accounts, different completion counts: ranks 1/2/3 sit in the correct visual order (2nd on the left, 1st in the middle, 3rd on the right).
- With one account: a single column shows correctly.
- With no completions: "Nobody has finished a puzzle yet."

---

# Phase 7 — Cleanup

### Prompt to paste

> Do Phase 7 of `docs/implementation-plan.md`. This is the last phase.

### Tasks

1. Remove props `seconds` and `onDirection` from `PlayScreen`'s interface and call site if they are unused in the body. Verify before removing.
2. Move `shadcn` from `dependencies` to `devDependencies` in `package.json` (and update the lockfile with `pnpm install`).
3. `lib/supabase/server.ts` is imported by nothing. Do **not** delete it; add a one-line comment at the top: `// Currently unused; kept for server-rendered features (e.g. leaderboard in a Server Component).`
4. Add `docs/puzzle_test/README.md`: one line stating these JSON files use a different schema (`x`/`y`, flat `clues`, `difficulty`) from the app and are an archive only.
5. Add `scripts/validate-puzzles.mjs`: takes a path to a JSON file exported from the Supabase `puzzles` table (array of rows with `id,title,puzzle_type,width,height,grid,clues`), runs the same checks as `validatePuzzleData` in `lib/crossword.ts`, and prints per-puzzle pass/fail with errors. It must not need the network or any secrets. This lets the user check hand-entered puzzles before inserting them. Document its usage at the top of the file. *(If `lib/crossword.ts` can't be imported from plain Node without a build step, say so and propose the lightest workaround before implementing.)*
6. Final sweep: `pnpm build`, then `grep -rn "console.log" app components hooks lib` and report any debug leftovers.

### Acceptance
- `pnpm build` passes; `git diff --stat` shows only the files listed above.

---

## After Phase 7

Tell the user: push `round3`, merge to `main`, and send the repo link to Claude in chat for the verification pass. Custom puzzle entry comes after that.