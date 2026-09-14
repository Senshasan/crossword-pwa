# Crossword PWA — Handoff

Repo: https://github.com/Senshasan/crossword-pwa (public, hosted currently on Vercel)

This project was scaffolded in v0, then moved off v0's workflow — the repo is now owned directly on GitHub with Supabase connected manually, not through v0/Vercel's native integration. Whoever/whatever picks this up next shouldn't assume any v0-specific tooling or context; everything needed should be in this file.

---

## 1. Context

A free, ad-free, installable crossword puzzle PWA (installs on iOS via Safari's "Add to Home Screen" — iOS has no install prompt, so that's the only path) being built as a birthday gift for a friend.

- **Multi-user**: the birthday friend *and* his family/friends all log in and play — not a solo, single-device experience.
- **Two puzzle categories**: `standard` puzzles (curated) and `custom` puzzles authored by the friend's family/friends as a personal touch, mixed into the sequence.
- **No content exists yet** — see §7. The code can be perfectly solid and there'd still be nothing to actually play until real puzzles are entered.

---

## 2. Stack

- **Next.js 16** (App Router). Note: Next 16 renamed `middleware.ts` → `proxy.ts` and the exported function from `middleware` → `proxy` — this repo's `proxy.ts` / `lib/supabase/proxy.ts` are correct for this, not a mistake or a stray file.
- TypeScript, Tailwind CSS, shadcn-style components, lucide-react icons.
- **Supabase**: Postgres + Auth. No custom backend server.
- **PWA**: `public/manifest.json` + a hand-written service worker (no Workbox).
- Deployed on Vercel currently, but deliberately not hard-coupled to it beyond hosting (see decisions below).

---

## 3. Architectural Decisions & Why

- **Supabase Auth (multi-user), not local-only.** Family/friends log in too, so progress has to live server-side per-user, not just in one browser.
- **OTP typed code, not magic link.** A magic link opened from the Mail app lands in Safari, not the installed home-screen PWA — that splits the session across two separate contexts on iOS. A 6-digit code typed directly into the running app avoids this, and also makes logging into a second device trivial. This requires the Supabase Auth email template to be changed to show `{{ .Token }}` in the dashboard — a manual step outside the codebase, worth re-confirming it's actually set.
- **Progress stored in Supabase, not localStorage.** The whole point is that a device switch or a cleared cache shouldn't lose anyone's place — Supabase is the source of truth, not the browser.
- **Conflict resolution via a simple `updated_at` compare-and-swap, not real merge logic.** The only realistic conflict is the same puzzle open on two devices at once — rare enough that last-write-wins with a conditional update (`where updated_at = lastKnownUpdatedAt`) is enough; a full merge/CRDT system would be solving a problem that barely exists here.
- **`order_index` + `category` on each puzzle, no hard locking.** One field drives both behaviors: the "Continue" flow always serves the lowest `order_index` incomplete puzzle (so custom puzzles can be placed at chosen milestones, e.g. every 5th slot), while a separate Browse view with category tabs lets anyone pick freely regardless of order. No puzzle is ever locked behind another.
- **No in-app puzzle editor, no public submission form.** A real crossword constructor (grid symmetry, auto-numbering, connectivity validation) is a bigger problem than the solver itself, and this is a small, one-time batch of puzzles. Family/friends send their puzzle ideas informally; they get hand-converted into the data format and inserted directly via Supabase's table editor or a seed script.
- **Decoupled from v0/Vercel's native Supabase integration on purpose.** Repo lives on GitHub, Supabase is connected manually — dependencies, env vars, and the database connection are all owned directly rather than managed through a platform-specific marketplace/integration layer.

---

## 4. Data Model

Client-side shape (after `lib/crossword.ts`'s `mapPuzzle()` transforms a Supabase row):

```typescript
export type Direction = 'across' | 'down'
export type PuzzleCategory = 'standard' | 'custom'

export interface Clue {
  number: number
  direction: Direction
  text: string
  answer: string
  row: number
  col: number
}

export interface CellData {
  row: number
  col: number
  letter: string
  isBlocked: boolean
  clueNumber?: number
  acrossClueId?: number
  downClueId?: number
}

export interface PuzzleData {
  id: string
  title: string
  category: PuzzleCategory
  orderIndex: number
  authorName?: string
  congratsMessage?: string
  dimensions: { rows: number; cols: number }
  clues: { across: Clue[]; down: Clue[] }
  grid: CellData[][]
}
```

**Supabase tables (inferred from what `app/page.tsx` actually queries — see Known Issue #2, this is not documented anywhere else):**

- `puzzles` — `id`, `title`, `puzzle_type` (not `category`), `order_index`, `width`, `height` (not a `dimensions` object), a flat `grid` array of single characters, `clues`. **This has drifted from earlier SQL drafts for this project, and there is no migration file in the repo** — the live schema currently only exists in the Supabase dashboard itself.
- `profiles` — one row per authenticated user, `display_name`.
- `puzzle_progress` — `user_id`, `puzzle_id`, `cell_state`, `completed`, `solve_time_seconds`, `completed_at`, `updated_at` (drives the compare-and-swap conflict handling in §3).

---

## 5. Key Files

- `app/page.tsx` — the app: auth screens, home/browse/play views, progress sync logic.
- `lib/crossword.ts` — types, `validatePuzzleData`, and two currently-broken, currently-unused sample puzzles.
- `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/proxy.ts` — Supabase client setup (env var mismatch lives here, Known Issue #1).
- `proxy.ts` (repo root) — Next.js 16's renamed middleware entry point.
- `public/manifest.json`, `public/sw.js` — PWA manifest and service worker.
- `app/layout.tsx` — root layout, metadata, icons, `@vercel/analytics`.

---

## 6. Current Status — What's Actually Working

Verified by reading the code directly, not just assumed:

- OTP auth flow (`signInWithOtp` → `verifyOtp`), code entry, not a magic link.
- Real crossword engine: direction toggle, active cell/word highlighting, keyboard input (letter auto-advance, backspace, arrow keys), a hidden input that triggers the real mobile keyboard, clickable clue list, Check Word / Check Grid, a victory modal with solve time and the custom puzzle's author message.
- Progress sync: grid hydrates from `puzzle_progress` on puzzle open, debounced save while playing, `updated_at` compare-and-swap on conflict.
- `validatePuzzleData` is actually wired into the puzzle-loading pipeline (`mapPuzzle`), gating which rows get shown to players.
- Service worker precaches Next.js's hashed build assets dynamically (parses `/`'s HTML for `_next/static/` URLs) instead of hardcoding filenames — correctly handles per-build hashing.
- Apple touch icon correctly references the real PNG.

**Needs verification, not independently confirmed one way or the other:**
- First-login `profiles` row / display-name creation step.
- RLS policies on `puzzles` / `puzzle_progress` against the *actual* live column names (the ones on record were written against an older schema draft — see Known Issue #2).
- Whether the Supabase Auth email template was actually changed to `{{ .Token }}` in the dashboard — required for OTP codes to work at all, and it's a manual dashboard step no code change touches.

---

## 7. Known Bugs / Issues To Fix

Ordered roughly by how much they'll actually break things.

1. **Env var name mismatch (auth-breaking).** `lib/supabase/client.ts` / `server.ts` read `NEXT_PUBLIC_SUPABASE_ANON_KEY`; `lib/supabase/proxy.ts` reads `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Only one of these is likely actually set, so one code path gets `undefined`. Supabase is mid-migration from `anon`/`service_role` key naming to `publishable`/`secret` (the old names are being phased out by end of 2026) — standardize on `publishable`/`secret` everywhere since that's the forward-compatible name.

2. **Schema drift between the code and the live table.** `page.tsx` queries `puzzle_type`, `width`, `height`, and a flat-array `grid`; earlier SQL drafts for this project used `category`, `dimensions`, and a nested `grid`/`clues` JSON shape. No migration file exists to check either against. Needs: (a) confirm what the live Supabase table actually looks like, (b) write and commit a real schema/migration file reflecting it, (c) fix RLS policies to match the real column names.

3. **The debounced save isn't actually debounced.** The `online`/`visibilitychange` effect has `seconds` in its dependency array; since `seconds` ticks every second during play, the effect's cleanup — which force-flushes any pending save — fires every second too, instead of every 2.5s as intended. Fix: drop `seconds` from that effect's dependency array (move it to a ref if the value is still needed inside).

4. **Invalid puzzle rows disappear with zero explanation.** `mapPuzzle` filters out any row that fails `validatePuzzleData`, but discards the `.errors` array it computes to do so. Since puzzles get entered by hand, a typo currently just makes a puzzle vanish from the list with no indication why. Fix: log the validation errors when a row gets dropped.

5. **The two sample puzzles in `lib/crossword.ts` are dead code, and broken.** Nothing imports `sampleStandard` or `sampleCustom`. Several `sampleStandard` down-clue answers don't match the grid's actual letters; every `sampleCustom` down-clue answer is a single character because of a `'WORD'[0]` bug (that's string-indexing — it evaluates to `'W'`, not the string `'WORD'`). Either fix them properly (and actually run them through `validatePuzzleData` this time) or delete them.

6. **`@vercel/analytics` is still active in `layout.tsx`.** Contrary to the stated goal of decoupling from Vercel-specific tooling. Harmless if deployed elsewhere (it no-ops off-Vercel), but worth pulling if platform independence is the actual goal rather than just avoiding the Supabase-Vercel integration specifically.

7. **Minor, confirm intentional:** the sticky active-clue bar doesn't have the originally-specced `<`/`>` prev/next skip buttons — only the clue list is clickable for navigation. Not broken, just a scope reduction worth a deliberate yes/no rather than an accidental gap.

---

## 8. Not Yet Started

- **No real puzzle content exists yet.** Zero standard or custom puzzles have actually been entered into Supabase. This is a content task, separate from and unblocked by the code issues above — and it's the one with an actual deadline (the birthday).
- **No documented "how to add a puzzle" process.** Once the schema (Known Issue #2) is nailed down, it's worth writing a short runbook for converting a family member's puzzle idea into a row — this is the recurring task for the rest of the project's life.
- **No leaderboard / solve-time comparison between players.** Discussed as an easy optional add-on given the app is multi-user, deliberately deferred rather than built. `puzzle_progress.solve_time_seconds` already exists, so this is mostly a UI task whenever it's wanted.
- **No end-to-end test of the multi-user flow.** Auth and sync logic have been read and reasoned through, but a second real account actually logging in, solving, and switching devices hasn't been verified in practice.
