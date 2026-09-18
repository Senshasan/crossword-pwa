# Fix Verification + Holistic Codebase Review

Reviewed: `Senshasan/crossword-pwa` @ `main`. `globals.css` 21 → 552 lines, `page.tsx` 203 → 1105 lines.

---

## Part 1 — Verification of Previous Report

| ID | Issue | Status | Notes |
|---|---|---|---|
| BUG-1 | Mystery input box | **Fixed** | `.keyboard-input` uses the opacity/1px pattern with `font-size: 16px` retained — correct, iOS keyboard will still open |
| BUG-2 | Blocked cells invisible | **Fixed** | `.cell.blocked` + `pointer-events: none`; `.cell.word-active` highlight also added |
| BUG-3 | Letter/number collision | **Fixed** | `.cell` is `position: relative`, `.cell small` absolutely positioned top-left |
| BUG-4 | "AcrossDown" / partial clues | **Fixed** | Tabs removed, merged list with `ArrowRight`/`ArrowDown` per row, correctly sorted by number then across-first, `.clue-row.active` highlight added, `sticky-clue` also shows direction |
| BUG-5 | Avatar signs out instantly | **Fixed** | Popover with name + email + explicit sign-out; outside-click via `pointerdown`, `Escape` handler, `aria-haspopup`/`aria-expanded` present |
| BUG-7 | Numbering unvalidated | **Fixed** | Canonical scan implemented correctly; also catches duplicate numbers across different cells |
| BUG-8 | Minor items | **Fixed** | `across[0]?.text ?? ""` guards in both places, `slice(0, 3)` on mini-grid, blocked cells `disabled` + `tabIndex={-1}` |

Dead CSS (`.keyboard`, `.success-banner`, `.install-modal`, `.family-strip`, `.cell.filled`, etc.) all removed. `.success-modal` and `.account-menu` now styled.

**Quality note:** these are real fixes, not surface patches. The clue-list sort and the numbering scan in particular are correct implementations, not approximations.

---

## Part 2 — CRITICAL: BUG-6 interaction

**BUG-6 (Interlocking's wrong clue numbers) was a cosmetic bug. BUG-7's fix just made it fatal.**

`mapPuzzle` drops any puzzle that fails `validatePuzzleData`. I ran the newly-added numbering logic against your live CSV data:

```
--- The Basics ---      PASSES
--- Media & Minds ---   PASSES
--- Interlocking ---
   ERROR: across clue at (2, 0) claims to be number 2, but should be 4
   ERROR: across clue at (4, 0) claims to be number 3, but should be 5
   ERROR: Clue number 2 is used at multiple different start cells
   ERROR: Clue number 3 is used at multiple different start cells
```

**If you haven't already corrected that row in Supabase, "Interlocking" is now silently gone from the app** — down to two playable puzzles. Check the browser console for the `console.warn` from `mapPuzzle`; it'll say so explicitly.

**Fix:** in the Supabase `puzzles` row for "Interlocking", set across `TRAIN` → `number: 4` and across `HAPPY` → `number: 5`. Down clues are already correct.

This is worth internalizing as a pattern: adding validation to a system with existing unvalidated data turns latent data bugs into disappearing content. Always re-run validation against production data right after tightening a validator.

---

## Part 3 — New Bugs Found

### NEW-1 — Browse view doesn't exist *(High)*

`view` is typed `"home" | "browse" | "play"`, and two buttons call `setView("browse")` — but **there is no `if (view === "browse")` branch anywhere.** Execution falls through to the home layout, so both "Browse all" and "See collection" appear to do nothing.

Consequences:
- `filter` state and `setFilter` are entirely dead — `setFilter` is never called. The All/Standard/Custom category tabs from the spec were never built.
- `filtered` is computed every render and never read.
- The home screen renders `puzzles.slice(0, 3)`. **With Browse broken, only the first 3 puzzles are reachable at all** — the rest are accessible only by grinding through "Continue".

You have exactly 3 puzzles, which is why this is currently invisible. It breaks the moment you add a 4th.

**Fix:** add a browse branch rendering `filtered` with category tabs wired to `setFilter`. This is the last unimplemented feature from the original spec (§4).

---

### NEW-2 — Stuck on "Loading your collection…" after first sign-in *(High)*

The data-fetching effect has dependency `[supabase]`, so it runs **once on mount**. It fetches puzzles only inside `if (data.user)`, and `setPuzzleLoading(false)` lives inside that same block.

For a user signing in during the session:
1. Mount: `getUser()` returns null → block skipped → `puzzleLoading` stays `true`
2. User completes OTP → `onAuthStateChange` sets `user` — but **does not fetch puzzles**
3. `ProfileScreen` → name saved → `profileReady` true
4. Next render hits `if (puzzleLoading) return <LoadingScreen />` → **stuck forever**

Only a manual page refresh recovers. You likely haven't hit this because your session persists; a first-time family member hits it on their very first login — the single worst place for it.

**Fix:** extract the profile/progress/puzzle fetch into a function keyed on `user?.id` (e.g. a `useEffect` with `[user?.id]`) so it re-runs when auth state changes, and ensure `setPuzzleLoading(false)` runs on every path including the no-user one.

---

### NEW-3 — Flash of login screen on every page load *(Medium)*

Line 216 calls `setAuthChecked(true)` **synchronously**, before the async `getUser()` resolves (it's called again correctly at line 251).

So on every load: `authChecked` is immediately true while `user` is still null → `AuthScreen` renders → `getUser()` resolves → real UI replaces it. Signed-in users see the "Welcome to Across & Along" sign-in card flash on every single visit. On a PWA launched from the home screen this looks like being logged out.

**Fix:** delete the `setAuthChecked(true)` on line 216.

---

### NEW-4 — Solve timer resets to zero on every resume *(Medium)*

In `flushProgress`, both the update and insert paths write:

```js
solve_time_seconds: pending.done ? secondsRef.current : null,
```

Every incremental save nulls out elapsed time. On reopening, `setSeconds(data.solve_time_seconds ?? 0)` gets `null` → `0`.

Result: the timer always restarts from zero for in-progress puzzles, even though the grid hydrates correctly. Cross-device resume half-works — answers survive, time doesn't. The final recorded solve time is also just the time since the last resume, not the true total.

**Fix:** always persist `secondsRef.current`, not only on completion.

---

### NEW-5 — `visibilitychange` listener leaks and accumulates *(Medium)*

```js
document.addEventListener("visibilitychange", () => { ... });   // inline anonymous fn
return () => {
  window.removeEventListener("online", flush);   // only 'online' removed
  ...
};
```

The `visibilitychange` handler is an inline arrow, so it can never be removed — and the cleanup doesn't try. The effect re-runs on `[user, active.id]`, i.e. **every time a puzzle is opened**, adding another listener each time. After opening 10 puzzles, backgrounding the tab fires 10 concurrent flushes.

**Fix:** name the handler and remove it in cleanup.

---

### NEW-6 — `checkWord` / `checkGrid` erase silently *(Medium, UX)*

Both functions blank out incorrect letters with no feedback whatsoever. From the player's side, clicking "Check Grid" makes letters vanish with no indication of what was wrong or that anything was checked — and on a correct grid, nothing happens at all, which reads as a broken button.

For a gift aimed at non-technical family, this is the most likely "is this thing broken?" moment in the app.

**Fix:** flash incorrect cells red briefly before clearing (a transient `.cell.wrong` class), and show a short confirmation when everything checked is correct.

---

### NEW-7 — Dead code *(Low)*

- `isSolved` (line 288) computed every render, never read. Completion is detected inline in `setLetter` instead.
- `filtered` (line 281) computed every render, never read (see NEW-1).
- `onDirection` passed to `PlayScreen` but unused since the tabs were removed.
- `puzzle_test/*.json` — three files in a different schema (`x`/`y`, flat `clues` array, `difficulty`) than the app uses. Raw generator output, not wired to anything. Move out of the repo or document what they're for.
- `handoff (1).md` and `bug-report.md` are committed at the repo root with a space and parenthesis in one filename. Move to `docs/`.

---

### NEW-8 — Still open from earlier *(Medium)*

- **`author_name` / `congrats_message` remain absent** from both the migration and the `.select()`. `PlayScreen` renders `{active.congratsMessage}` and `— {active.authorName}` for custom puzzles, so **the personalized family message will render as an empty line and a bare em-dash.** This is the emotional core of the gift; it's currently non-functional. You deferred this deliberately, but it's now the largest remaining gap.
- No `<`/`>` prev/next buttons on the active clue bar (deferred).
- Only 2 `@media` blocks total for a mobile-first PWA. The grid is `aspect-ratio: 1` and fluid so it should hold up, but the 5-column clue/grid split and the account popover positioning deserve a real check on a narrow viewport.

---

## Part 4 — Structural Observations

**`app/page.tsx` is 1105 lines and holds everything** — auth screens, profile screen, home, play screen, puzzle card, all state, all sync logic. It was ~200 lines two iterations ago. The next feature (browse view) makes it worse.

Suggested split, in rough priority order:
- `components/AuthScreen.tsx`, `ProfileScreen.tsx`, `LoadingScreen.tsx` — self-contained, zero shared state, trivial to extract
- `components/PlayScreen.tsx` + `CrosswordGrid.tsx` + `ClueList.tsx`
- `hooks/usePuzzleProgress.ts` — `flushProgress`/`saveProgress`/hydration; this is the most intricate logic in the app and is currently interleaved with render code
- `hooks/useAuth.ts` — fixes NEW-2 and NEW-3 naturally as a side effect of doing it properly

**`PlayScreen` is typed `({ ...16 props }: any)`** — the entire play surface has no type checking. Given `PuzzleData` and `Clue` already exist, a props interface is cheap and would have caught prop drift.

**No tests, and no way to run the validator outside the browser.** `validatePuzzleData` is your safety net for hand-entered content, but the only way to exercise it is to load the app and read the console. A tiny Node script that reads a JSON file and prints errors would let you validate a puzzle *before* inserting it — worth having before the next batch.

---

## Recommended Order

1. **BUG-6 data fix** — Interlocking may be invisible right now. One Supabase edit.
2. **NEW-2 + NEW-3** — both auth-lifecycle; fix together. New users currently hit a dead end.
3. **NEW-4 + NEW-5** — small, contained correctness fixes in the sync layer.
4. **NEW-1 browse view** — becomes blocking the moment puzzle #4 exists.
5. **NEW-8 author/congrats columns** — needed before any custom puzzle is entered.
6. **NEW-6 check feedback** — highest-value UX polish for non-technical players.
7. **NEW-7 cleanup + Part 4 refactor** — do the component extraction before the codebase grows again.
