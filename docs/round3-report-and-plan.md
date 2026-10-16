# Round 3 — Verification, Bug Report, Implementation Plan

Reviewed: `Senshasan/crossword-pwa` @ `main` against `walkthrough.md`.
`page.tsx` 1105 → 572 lines; components and hooks extracted as described.

---

## Part 1 — Verification of the Walkthrough's Claims

Every claim was checked against the actual code, not the summary.

| Claim | Status | Notes |
|---|---|---|
| Components extracted | **True** | `AuthScreen`, `ProfileScreen`, `LoadingScreen`, `PuzzleCard`, `PlayScreen` all in `components/` |
| Hooks extracted | **True** | `useAuth`, `usePuzzles`, `usePuzzleProgress`; `page.tsx` is now a coordinator |
| NEW-1 browse view built | **True in source** | Full branch at `page.tsx:461` with working filter tabs. See USER-1 — you are not seeing it for a different reason |
| NEW-2 puzzle load keyed on user | **True** | `usePuzzles(supabase, user?.id)` re-runs on auth change; `setPuzzleLoading(false)` on the no-user path too |
| NEW-3 auth flash | **True** | The synchronous `setAuthChecked(true)` is gone; only called after `getUser()` resolves |
| NEW-4 timer persistence | **True** | `const solve_time_seconds = secondsRef.current` on both update and insert paths |
| NEW-5 listener leak | **True** | `handleVisibility` named and removed in cleanup |
| NEW-6 check feedback | **Partial** | Toast works; the red flash is implemented but **shows on an already-emptied cell** — see MINE-2 |
| NEW-8 prev/next clue buttons | **True** | `handleNextClue`/`handlePrevClue` with correct wraparound |
| NEW-8 author/congrats | **True in code** | Migration `20260918000000`, queried in `usePuzzles`, rendered in modal. **But the migration must be applied or the app breaks — see MINE-1** |
| NEW-7 docs moved | **True** | `docs/` now holds the three markdown files and `puzzle_test/` |
| `PlayScreen` typed | **True** | Proper `PlayScreenProps` interface replaces `any` |
| "Builds error-free with `next build`" | **Plausible, unverified** | I can't run the build here (no network access to the npm registry from this environment). Nothing I read would fail type-checking |

The refactor itself is good work. The hooks have clean boundaries, and `usePuzzleProgress` correctly keeps the compare-and-swap logic intact through the move.

---

## Part 2 — Your Reported Issues

### USER-1 — "Browse all" / "See collection" still dead ✅ *diagnosed*

**The code is correct. Your service worker is serving you a months-old build.**

`public/sw.js`:

```js
const CACHE = 'across-along-v1';   // never changes
// ...
url.pathname === '/'               // the HTML shell is cached
cached || fetch(event.request)     // cache-first: cache always wins
```

Three compounding problems:

1. **`/` is cached cache-first.** Once cached, the browser serves the old HTML forever — and that HTML references the old hashed `/_next/static/` chunks, so the entire old app keeps loading.
2. **The cache name is hardcoded `v1`.** The `activate` handler deletes caches where `key !== CACHE`, but since `CACHE` is always `'across-along-v1'`, it never deletes anything.
3. **`sw.js` itself never changes**, so the browser never re-runs `install`, so the cached `/` is never refreshed. `skipWaiting()` doesn't help — there is no new worker to activate.

Net effect: **no user who has ever loaded the app can receive an update.** Refreshing does nothing; the SW intercepts it. This has been silently shipping broken deploys to you for at least two rounds, and it is the single most important bug in the repo right now.

This also explains why the browse buttons look dead: you are running the build from *two rounds ago*, which genuinely had no browse branch.

**Immediate unblock:** iOS Safari → Settings → Safari → Advanced → Website Data → delete the site; or delete and re-add the home-screen app. Then apply the fix in Part 4 so it never recurs.

---

### USER-2 — Clue click lands on a filled cell ✅ *confirmed, valid*

`page.tsx:387` — `onClue` sets the cursor to `clue.row, clue.col` unconditionally. `handleNextClue`/`handlePrevClue` do the same. Your proposed behavior (jump to the first *empty* cell in the word, falling back to the first cell if the word is full) is the standard crossword convention and the right call.

---

### USER-3 — "Browse all" misaligned on mobile ✅ *confirmed*

```jsx
<div className="mt-14 flex items-end justify-between">
  <div>… <h2>Pick up where you left off</h2></div>
  <button className="browse-link">Browse all <ChevronRight/></button>
</div>
```

`.browse-link` is `display: inline-flex` with no `white-space: nowrap` and no `flex-shrink: 0`. On a narrow viewport the `h2` wraps to two lines and consumes the row, so the flex container shrinks the button until "Browse all" wraps mid-label — exactly what your screenshot shows. There's also no `gap` between the two flex children.

---

### USER-4 — No way to refresh in standalone mode ✅ *confirmed, and worse than you think*

There is no refresh mechanism, no pull-to-refresh, and — critically — **`usePuzzles` exposes no refetch function at all**. The puzzle list is fetched exactly once per `userId` change and can never be re-fetched without a full page reload, which standalone mode makes awkward.

Pull-to-refresh is very doable. Note the interaction with USER-1: a refresh only helps once the service worker stops serving a stale shell.

---

### USER-5 — Install hint shows even when installed ✅ *confirmed*

`page.tsx:512` renders the hint unconditionally. No `display-mode: standalone` check exists anywhere in the codebase. Your assumption is right — this is a two-line fix.

---

### USER-6 — "Interlocking" missing ⚠️ *not the cause you assumed*

Puzzle data is fetched from Supabase at runtime and Supabase is cross-origin, so the service worker never touches it (`sw.js:25` checks `sameOrigin`). Stale caching is **not** why Interlocking is missing.

The real cause is almost certainly that **you never corrected the clue numbering in Supabase.** From my last report: across `TRAIN` must be `number: 4` (not 2), across `HAPPY` must be `number: 5` (not 3). The validator you added in the previous round rejects the row, and `mapPuzzle` drops it with a `console.warn`.

Severity is higher than you assumed: it's a permanently missing puzzle, not a refresh artifact.

---

### USER-7 — Leaderboard ⚠️ *feature request with an RLS blocker*

Requested: top-three users by puzzles completed, on a podium, in the account menu.

**Your current RLS policies make this impossible from the client:**

```sql
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can view own progress" ON public.puzzle_progress FOR SELECT USING (auth.uid() = user_id);
```

Any client-side leaderboard query returns only the current user's own row. This needs a database change, not just UI. Two options, covered in Part 4.

---

## Part 3 — Additional Findings *(mine, not on your list)*

### MINE-1 — Applying the new migration is mandatory, and skipping it empties the app 🔴 *Critical*

`usePuzzles.ts:28` now selects `author_name,congrats_message`. If migration `20260918000000_add_author_congrats.sql` has **not** been applied, Postgres rejects the entire query (`column does not exist`) — not just those two fields. Then:

```js
if (puzzlesResponse.data) { setPuzzles(...) }   // data is null, never runs
```

`puzzles` stays `[]` → you hit the "Your collection is getting ready / No puzzles have been added yet" screen with **zero puzzles**, and nothing is logged anywhere. The walkthrough lists applying the migration as an optional-sounding "next step"; it is in fact a hard prerequisite for the app functioning at all.

Compounding this: **neither Supabase query in `usePuzzles` checks `.error`.** Every failure mode — RLS rejection, missing column, network error — presents identically as an empty collection with a silent console.

### MINE-2 — The "flash red" feedback flashes an empty cell 🟠 *High*

In `checkWord`/`checkGrid`:

```js
wrongs.add(key);
next[key] = "";        // letter erased in the same pass
```

`setAnswers(next)` and `setWrongCells(wrongs)` commit together, so the cell turns red **and** blanks in the same frame. The player sees an empty red square and never learns which letter was wrong. The intent of NEW-6 was to show the mistake before clearing it.

Also, `wrongCells` has no timer — the red persists until the next click or keystroke, so "briefly flashed" isn't accurate either.

### MINE-3 — Mobile CSS hides all but 2 puzzles *in the Browse view* 🔴 *Critical*

```css
@media (max-width: 700px) {
  .puzzle-grid .puzzle-card:nth-child(n + 3) { display: none; }
}
```

This was written for the home screen's 3-card preview, but **Browse uses the same `.puzzle-grid` class**. On your iPhone, the Browse view will show at most 2 puzzles no matter which filter is selected — making the feature you're about to unblock look broken on the device it matters most on.

### MINE-4 — Content renders under the iPhone notch 🟠 *High*

`layout.tsx` sets `statusBarStyle: 'black-translucent'`, which makes the web view extend beneath the status bar. But there is **no `viewport-fit=cover`** and **no `env(safe-area-inset-*)` padding anywhere in `globals.css`**. On an iPhone 14 in standalone mode the header sits under the clock and battery. This is visible in your screenshot.

Either use `statusBarStyle: 'default'`, or commit to translucent and add safe-area padding — not the current halfway state.

### MINE-5 — Manifest has no PNG icon 🟡 *Medium*

`manifest.json` lists only `/icon.svg`, including an entry claiming `"sizes": "180x180"` for an SVG. iOS ignores SVG manifest icons. Your home-screen icon currently works only because `layout.tsx` separately declares `apple-icon.png`. Any non-iOS install surface gets no usable icon. There are already-generated PNGs in `public/` that go unused.

### MINE-6 — `lib/supabase/server.ts` is entirely dead code 🟡 *Medium*

25 lines implementing a server-side Supabase client, imported by nothing. `page.tsx` is the only route and it's `"use client"`. Relevant to your Next.js question — see Part 5.

### MINE-7 — Completed puzzles keep overwriting their solve time 🟡 *Medium*

The timer effect runs whenever `view === "play"` and the modal is closed. After finishing a puzzle and clicking "Keep solving", the timer resumes and subsequent saves overwrite `solve_time_seconds` with an ever-growing value. Reopening a finished puzzle does the same. Your recorded solve times will drift upward — which matters directly for USER-7's leaderboard if you ever rank by time.

### MINE-8 — Dead props and dead code 🟢 *Low*

- `PlayScreen` receives `seconds` and `onDirection`; neither is used in the body (`time` is used instead, and direction toggling happens via `onCell`).
- `shadcn` is listed as a runtime `dependency` in `package.json`. It's a CLI scaffolding tool and belongs in `devDependencies` at most — it ships nothing to the browser.
- `docs/puzzle_test/*.json` are in a schema the app doesn't use (`x`/`y`, flat `clues`, `difficulty`). Fine as an archive now that they're in `docs/`, but add a one-line README so future-you doesn't mistake them for fixtures.

---

## Part 4 — Implementation Plan

Ordered so that each step unblocks verification of the next. **Steps 1–3 must happen before anything else can be confirmed working.**

### Step 1 — Fix the service worker *(unblocks everything)*

`public/sw.js`:

1. **Network-first for the HTML shell.** Change the `/` handling so it tries the network first and falls back to cache only when offline. Keep cache-first for `/_next/static/` — those filenames are content-hashed and safe to cache forever.
2. **Version the cache.** Replace `'across-along-v1'` with a build-stamped constant, e.g. `const CACHE = 'across-along-' + BUILD_ID`. Simplest approach without a build step: bump it manually on each deploy, and treat that as part of the deploy ritual. Better: generate `sw.js` at build time so the constant changes automatically.
3. **Keep the `activate` cleanup** — it becomes functional once the name actually changes.
4. Consider adding a `SKIP_WAITING` message handler so the app can activate a new worker without a second reload.

**Then, once:** clear site data on your phone to escape the current stale cache.

**Verify:** deploy a trivial visible change, reload twice, confirm it appears.

### Step 2 — Apply the migration and add error handling *(MINE-1)*

1. Run `20260918000000_add_author_congrats.sql` against your Supabase project. **Do this before deploying the current code**, or every user sees an empty collection.
2. In `usePuzzles.ts`, check `.error` on both queries and `console.error` them. Surface a distinguishable UI state for "query failed" vs "genuinely no puzzles" — right now they're identical.

### Step 3 — Fix the Interlocking data *(USER-6)*

In the Supabase `puzzles` row for "Interlocking", edit the `clues` JSON: across `TRAIN` → `"number": 4`, across `HAPPY` → `"number": 5`. Down clues are already correct. Reload and confirm it appears and the console warning is gone.

### Step 4 — Mobile layout fixes *(USER-3, MINE-3, MINE-4)*

1. **Scope the card-hiding rule to the home preview only.** Give the home grid its own class (e.g. `puzzle-grid preview-grid`) and change the media-query rule to `.preview-grid .puzzle-card:nth-child(n + 3) { display: none; }`. Or drop the CSS hack entirely and use `puzzles.slice(0, 2)` on mobile — the JSX already slices to 3.
2. **`.browse-link`:** add `white-space: nowrap; flex-shrink: 0;`, and add `gap-4` to the two flex rows containing it.
3. **Safe areas:** add `viewport-fit: cover` to the `viewport` export in `layout.tsx`, then pad the fixed headers with `env(safe-area-inset-top)` and the bottom controls with `env(safe-area-inset-bottom)`. If you'd rather not deal with it, switch `statusBarStyle` to `'default'` and skip the padding.

### Step 5 — Hide the install hint when installed *(USER-5)*

```js
const [isStandalone, setIsStandalone] = useState(false);
useEffect(() => {
  setIsStandalone(
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true   // iOS Safari's own flag
  );
}, []);
```

Both checks are needed: iOS historically didn't report `display-mode: standalone` reliably, and `navigator.standalone` is the iOS-specific fallback. Gate the hint on `!isStandalone`. Compute it in an effect, not during render, to avoid a hydration mismatch.

### Step 6 — Cursor lands on first empty cell *(USER-2)*

Add a helper in `page.tsx`:

```js
function firstEmptyCell(clue: Clue) {
  const cells = getWordCells(active, clue);
  return cells.find(c => !answers[keyFor(c.row, c.col)]) ?? cells[0];
}
```

Use it in three places: `onClue`, `handleNextClue`, `handlePrevClue`. The `?? cells[0]` fallback keeps behavior sane for an already-complete word.

Worth considering as a follow-up: apply the same logic to the auto-advance in `setLetter`, so typing skips over letters already filled by intersecting words. That's the other half of the same annoyance.

### Step 7 — Fix check feedback *(MINE-2)*

Separate the flash from the clear:

1. On check, set `wrongCells` but **leave `answers` untouched**.
2. After ~800ms, clear the wrong letters and empty `wrongCells`.
3. Store the timeout in a ref and clear it on unmount and on puzzle change, so an in-flight flash doesn't blank cells in a different puzzle.

### Step 8 — Pull-to-refresh *(USER-4)*

1. **Expose a refetch.** Have `usePuzzles` return a `refetch()` that re-runs `loadData`. This is worth doing regardless of the gesture — there is currently no way to pick up new puzzles without a full reload.
2. **Gesture:** on the scroll container, track `touchstart` Y position; if `scrollTop === 0` and the user drags down past a threshold (~70px), show a spinner and call `refetch()`. Release below threshold cancels.
3. Set `overscroll-behavior-y: contain` on the scroll container so iOS's native rubber-band doesn't fight your handler.
4. Respect `prefers-reduced-motion` for the spinner animation — you already have a media query for it.

**Fallback if the gesture proves fiddly:** a refresh button in the account menu (Step 9) calling the same `refetch()`. I'd build `refetch()` first and wire the button immediately, then add the gesture on top — that way you're never blocked.

### Step 9 — Leaderboard *(USER-7)*

**Database first — this is the blocking part.** Two options:

**Option A (recommended): a `SECURITY DEFINER` RPC.** Add a function that returns aggregated results only, bypassing RLS in a controlled way:

```sql
CREATE OR REPLACE FUNCTION public.get_leaderboard(limit_count int DEFAULT 3)
RETURNS TABLE (display_name text, completed_count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.display_name, COUNT(pp.puzzle_id) AS completed_count
  FROM profiles p
  LEFT JOIN puzzle_progress pp
    ON pp.user_id = p.id AND pp.completed = true
  GROUP BY p.id, p.display_name
  ORDER BY completed_count DESC, p.display_name ASC
  LIMIT limit_count;
$$;

REVOKE ALL ON FUNCTION public.get_leaderboard(int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(int) TO authenticated;
```

This exposes only display names and counts — never raw progress rows or emails. Call it with `supabase.rpc('get_leaderboard', { limit_count: 3 })`.

**Option B: loosen RLS** so authenticated users can read all `profiles.display_name` and all `puzzle_progress` rows. Simpler, but it exposes every user's full progress to every other user and puts the aggregation on the client. In a closed family app that's arguably acceptable — but Option A is barely more work and doesn't require thinking about it again later.

**UI:** render the podium inside the account menu. The menu is currently a small absolutely-positioned popover; a three-column podium will need it widened, and on mobile it should probably become a bottom sheet rather than a popover. Fetch on menu open, not on mount. shadcn has no podium primitive — three flex columns with different heights and `order-2 order-1 order-3` to put first place in the middle is the whole implementation.

**Ordering caveat:** fix MINE-7 before showing any time-based ranking, or the numbers will be wrong. Ranking purely by completion count (what you asked for) is unaffected.

### Step 10 — Cleanup

Delete `lib/supabase/server.ts` (or start using it — see Part 5), drop the unused `seconds`/`onDirection` props from `PlayScreen`, move `shadcn` to `devDependencies`, add PNG entries to the manifest, add a README to `docs/puzzle_test/`.

---

## Part 5 — What Gemini Did With Next.js

Three separate things got added. Here's what each is, whether it's useful, and whether it's right.

### 1. `proxy.ts` + `lib/supabase/proxy.ts` — session-refresh middleware

**What it is.** In Next.js 16, the file formerly called `middleware.ts` was renamed to `proxy.ts`, and the exported function from `middleware` to `proxy`. It's the same feature: code that runs on the server for every matching request, before the page renders. So `proxy.ts` is not something exotic — it's Next's standard middleware under its new name, and using that name is **correct** for Next 16. Nothing wrong here.

**What it does.** `updateSession()` creates a server-side Supabase client wired to the request's cookies and calls `supabase.auth.getUser()`. That call has a side effect: if the access token is expired, Supabase silently refreshes it and writes new cookies onto the response. This is Supabase's officially documented SSR pattern, and the implementation follows it faithfully — including the fiddly `setAll` dance of rebuilding `NextResponse.next({ request })` so refreshed cookies reach both the request and the response.

**Is it useful here?** Honestly, marginal. The pattern exists so that *server-rendered* pages and route handlers can read a valid session. Your app has exactly one route, it's `"use client"`, and every Supabase call happens in the browser with the browser client, which refreshes its own tokens. So the middleware is refreshing cookies that nothing on the server ever reads.

It isn't useless: it keeps the cookie-based session from going stale during long gaps between visits, which makes returning to the app after a while slightly more reliable. But it isn't load-bearing, and if you deleted it today you'd probably notice nothing.

**Implemented correctly?** Yes, with one wart: the matcher excludes `_next/static`, `_next/image`, `favicon.ico`, and common image extensions — but **not `/sw.js` or `/manifest.json`**. So your service worker script and manifest each get a pointless server round-trip with Supabase cookie logic attached. Harmless in practice, but add them to the matcher's exclusion list while you're in there.

**Verdict:** keep it. It's correct, it's the canonical pattern, and it costs you little. Just know it's currently insurance rather than infrastructure.

### 2. `lib/supabase/server.ts` — the server client

This is the third piece of Supabase's standard SSR trio (browser client / server client / middleware). **Nothing imports it.** It's dead code today.

It becomes genuinely useful the moment you server-render anything — the leaderboard is the obvious candidate, since fetching it in a Server Component would mean the data arrives with the HTML instead of after a client round-trip. Your call: delete it now and re-add when needed, or leave it as scaffolding. I'd lean toward leaving it, given the leaderboard is next on your list. Just don't mistake it for something currently doing work.

### 3. `next.config.mjs` — `images: { unoptimized: true }`

This disables Next's built-in image optimization pipeline. Normally `next/image` optimizes and resizes images on the fly, which on Vercel is a served-and-billed feature and on other hosts requires a running Node server.

**Is it needed?** Not really — you don't use `next/image` anywhere. But it's a sensible default for your situation for two reasons: it's one less piece of Vercel-specific behavior (matching your decoupling goal), and it keeps the door open for a static export if you ever move off Vercel to a plain static host. It costs nothing since your only images are small static PNGs and an SVG.

**Verdict:** harmless, mildly aligned with your goals. Leave it.

### Summary

Nothing Gemini added is wrong or risky. The `proxy.ts` rename is correct for Next 16 and the middleware follows Supabase's documented pattern precisely. It's just that two of the three pieces are currently inert — appropriate scaffolding for an app that does server-side work, which yours doesn't do yet.

---

## Questions For You

1. **Has migration `20260918000000_add_author_congrats.sql` been applied to Supabase yet?** If not, don't deploy the current code until it is — see MINE-1. If you've applied it and are *still* seeing puzzles, that tells me something else is going on and I'd want to look again.

2. **Interlocking:** did you edit that row's clue numbers and it's still missing, or was that fix never made? Determines whether USER-6 is closed by Step 3 or needs a deeper look. Either way, please check the browser console for a `[crossword] Puzzle "Interlocking" … dropped` warning and send me the error list if it's there.

3. **Leaderboard scope:** rank strictly by puzzles completed, or break ties by total solve time? Time-based ranking needs MINE-7 fixed first, and needs a decision on whether re-opening a finished puzzle should be able to change your recorded time.

4. **Leaderboard privacy:** happy for everyone to see everyone's display name and completion count? It's a family app so I assume yes, but Option A vs Option B in Step 9 partly turns on that.

5. **Deploy ritual for the SW cache version:** do you want the manual bump (simplest, but easy to forget — and forgetting silently ships a broken update), or should the plan include a small build step that stamps `sw.js` automatically? I'd recommend the latter given this has already bitten you twice without either of us noticing.
