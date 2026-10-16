# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Across & Along" — a private, ad-free, installable crossword PWA for a small group of family and friends. Several people log in, and each person's progress syncs across their devices. Users mostly install it on iOS through Safari's "Add to Home Screen", so standalone-mode behavior matters: there is no browser refresh button and no install prompt.

## Working agreements

These apply to every task. The work queue is `docs/implementation-plan.md`, done one phase at a time.

- Do only the phase the user names, then stop. Do not start the next phase.
- Before saying anything is done, run `pnpm exec tsc --noEmit` and `pnpm build` and show the results.
- When a phase finishes, list the files you changed and give the user the phase's "You verify" list.
- Never read, edit or print `.env*` files or keys.
- Migrations are applied by the user, by hand, in the Supabase SQL editor. You never run them. You may only **add** new files to `supabase/migrations/`; never edit an existing one.
- Do not add npm dependencies without asking first.
- Reference files for the current round are in `docs/drop-in/`. Use them verbatim unless the phase says otherwise. If you think one is wrong, say so rather than silently rewriting it.
- If the repo contradicts the plan, stop and report it instead of guessing.
- If a task changes something this file describes, update this file in the same task.

## Commands

The package manager is pnpm (`packageManager` in package.json).

- `pnpm dev`: dev server on http://localhost:3000. The service worker is not registered in dev.
- `pnpm build`: next build. Both `dev` and `build` first run `scripts/stamp-sw.mjs` (via `predev` / `prebuild`), which generates the gitignored `public/sw.js` from `sw-src/sw.js`. Edit `sw-src/sw.js`, never `public/sw.js`.
- `pnpm start`: serve the production build
- Type-check: `pnpm exec tsc --noEmit`

There is no linter and there are no tests.

Env vars (`.env.local`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Use the `publishable` key name everywhere, never `ANON_KEY`.

## Architecture

**A client-side SPA in one route.** `app/page.tsx` (`"use client"`) is the coordinator for the whole app. It switches between `home` / `browse` / `play` views with local state (no router navigation), and it holds the crossword engine logic: cursor movement, direction toggle, word cells, check word/grid, prev/next clue. The presentational screens in `components/` (`AppHeader`, `HomeScreen`, `BrowseScreen`, `PlayScreen`, `AuthScreen`, `ProfileScreen`, `LoadingScreen`) get their state and callbacks as props. `components/ui/` holds shadcn components (style `base-nova`, built on `@base-ui/react`).

**Visual system.** Tailwind v4 is configured CSS-first in `app/globals.css`, where the colour tokens (paper/ink, sage `--brand*` for the collection, coral `--family*` for puzzles from family, grid `--cell*`/`--block`) are defined for light and `.dark`. Fonts come from `next/font` in `app/layout.tsx`: Newsreader for headings and clue text, Schibsted Grotesk for UI and grid letters. Dark mode is a `.dark` class on `<html>`, set before first paint by an inline script in `layout.tsx` (saved choice in `localStorage.theme`, else the system setting). Puzzle previews use `PuzzleThumb` (block pattern only), so they never show answer letters. Category labels come from `categoryLabel()` in `components/PuzzleBits.tsx`. `components/BrandMark.tsx` and `public/icon.svg` are the same drawing; the PNG icons (`apple-icon.png`, `icon-192.png`, `icon-512.png`) were rendered from it.

**Data flow through hooks**, each of which takes the singleton browser Supabase client from `lib/supabase/client.ts`:
- `useAuth`: OTP email auth plus the `profiles.display_name` onboarding step. It uses a typed 6-digit code, not a magic link, because a magic link would open Safari outside the installed PWA. This needs the Supabase email template to include `{{ .Token }}`, which is set in the dashboard, not in code.
- `usePuzzles`: fetches the `puzzles` rows and the user's completion list, and re-runs when the user id changes.
- `usePuzzleProgress`: the solve timer and progress sync. Saves are debounced by 2.5s and flushed immediately on completion, on `visibilitychange`→hidden, on `online`, and on unmount. Conflicts are handled with an **optimistic compare-and-swap on `updated_at`**: an update conditioned on `updated_at = lastKnownUpdatedAt`. If no row matches, it refetches the server state, or inserts a row if none exists. The client sets `updated_at` itself, so never add a DB trigger that auto-updates it.

**Puzzle format.** DB rows (`PuzzleRow`) store a flat `grid: string[]` of length `width*height` (`"#"` = blocked cell), plus `clues: {across, down}` JSONB in which each clue has `number, text, answer, row, col`. `mapPuzzle()` in `lib/crossword.ts` turns a row into the nested `PuzzleData` grid with clue ids and numbering, then runs `validatePuzzleData()`. That check covers answers against the grid, intersections and canonical numbering. **Any puzzle that fails is silently dropped from the UI** (it only logs a `console.warn`), so check the console when a puzzle doesn't show up. The JSON files in `docs/puzzle_test/` use a different format (`x`/`y`, `clue`, `dimensions`) and would need converting first. Puzzles are entered by hand through the Supabase table editor or SQL; the app has no editor.

**Ordering.** `order_index` decides the "Continue" puzzle: the lowest-index puzzle that isn't complete. `puzzle_type` (`standard` | `custom`) drives the Browse filter tabs. No puzzle is ever locked. Custom puzzles carry `author_name` / `congrats_message`, which appear in the victory modal.

**Supabase schema** lives in `supabase/migrations/` (`profiles`, `puzzles`, `puzzle_progress` with row-level security limited to the user's own rows; `puzzles` is read-only for authenticated users). Migrations are applied to the hosted project by hand. If a migration that adds columns the app selects isn't applied, the whole puzzle query fails. The leaderboard uses the `get_leaderboard` RPC, a `SECURITY DEFINER` function, because RLS blocks reading other users' progress. A `keep_first_clear` trigger makes a first clear permanent: once `completed` is true, updates cannot set it back, or change `completed_at` / `solve_time_seconds`. That trigger deliberately does **not** touch `updated_at`, so it is compatible with the compare-and-swap above. Don't remove it or change its meaning.

**Next.js 16 specifics.** Middleware is now called `proxy`. The root `proxy.ts` calls `lib/supabase/proxy.ts`'s `updateSession` to refresh auth cookies; this is correct and not a stray file. `lib/supabase/server.ts` is currently unused.

**Service worker** (hand-written, no Workbox). The source is `sw-src/sw.js`. `scripts/stamp-sw.mjs` replaces `__BUILD_ID__` in it to give the cache name `across-along-<id>`, where `<id>` is the Vercel commit SHA, the local git SHA (with a timestamp suffix if the working tree is dirty), or `dev`. Navigations are network-first (4s timeout) with the cached `/` shell as an offline fallback. `/_next/static/`, the manifest and the icons are cache-first. On install it precaches the hashed assets by parsing `/`'s HTML. Old caches are purged on activate. `hooks/useServiceWorker.ts` registers the worker in production only, re-checks for updates whenever the app comes back to the foreground (iOS resumes standalone apps without a navigation), and exposes `updateReady` / `applyUpdate`. `components/UpdateBanner.tsx` asks the user to reload; accepting posts `SKIP_WAITING`, and the page reloads on `controllerchange`. `proxy.ts` excludes `sw.js` and `manifest.json` from the auth middleware. A cache-first shell with a fixed cache name once stopped users from ever receiving updates, so: keep navigation network-first, never call `skipWaiting()` during install (the page decides when to switch, so an update can't reload someone mid-puzzle), and don't hand-edit a generated `public/sw.js`.

## Docs

**Start with `docs/project-status.md`**: it records current progress, open items and what still needs verifying on a phone. Update it when meaningful work lands.

`docs/` also holds review and handoff notes from earlier rounds (`handoff (1).md`, `bug-report.md`, `fix-verification-and-review.md`, `round3-report-and-plan.md`) plus this round's `implementation-plan.md` and `drop-in/` reference files. The older notes explain design decisions and list known issues. Parts of the handoff are out of date: the env var mismatch and the missing migrations have since been fixed. Treat the code as the source of truth.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
