# Round 5 — Implementation plan for the AI (Claude Code)

Read `CLAUDE.md` first; its Working agreements apply. **Do only the phase the user names, then stop.** Each phase ends with: `pnpm exec tsc --noEmit`, `pnpm build`, a list of changed files, and the phase's "You verify" list from `03-your-checklist.md`. Migrations and seed SQL are **added** as new files and applied by the user by hand; never run them, never edit existing migrations. No new npm dependencies without asking. If the repo contradicts this plan, stop and report.

## Decisions (fixed for this round)
- App language is German only. No language switcher, no i18n library.
- Answers use A–Z only: Ä→AE, Ö→OE, Ü→UE, ß→SS. Grid input regex stays `/^[a-zA-Z]$/`.
- `puzzles.difficulty` ∈ `easy|medium|hard`. Sizes 9×9, 12×12, 15×15.
- Never change `grid` or `width/height` of a published puzzle (progress stores cell state positionally). Clue text may be fixed in place.

---
## Phase A — German UI
**Step 0:** `grep` all user-visible strings (JSX text, `aria-label`, `placeholder`, `title`, toasts in `app/page.tsx`, `metadata` in `app/layout.tsx`, `public/manifest.json`, auth error messages in `hooks/useAuth.ts`, `categoryLabel`). Report the count before editing.
1. Create `lib/strings.ts`: one typed `de` object, grouped by screen; interpolations as small functions (e.g. `lettersWrong: (n) => n === 1 ? "1 Buchstabe ist falsch." : \`${n} Buchstaben sind falsch.\``). Use real German typography (ä ö ü ß in UI text is fine; the OE/SS rule is for grid answers only).
2. Replace every hardcoded string with it. Du-form throughout, friendly, short. Examples: "Puzzles", "Weiter", "Alle ansehen", "Von der Familie", "Standard", "Wort prüfen", "Rätsel prüfen", "Zurücksetzen" / "Gitter leeren?", "Gelöst.", "Zurück zu den Rätseln", "Neue Version verfügbar" / "Neu laden", "Abmelden".
3. `<html lang="de">`; manifest `lang: "de"`, German `description`; page `<title>` and metadata German. Keep `name`/`short_name` "Across & Along" unless the user says otherwise.
4. Map Supabase auth errors to German messages (wrong/expired code, rate limit, network); never show raw English server text.
5. Format the solve time and any dates with `de-DE`.
6. Umlaut hint: a short static line under the play grid ("Umlaute: AE, OE, UE · ß: SS") and a toast (same text) when the user types Ä/Ö/Ü/ß/ä/ö/ü; no letter is entered. Handle in `onKey` in `app/page.tsx`.
7. Update `CLAUDE.md` (German-only, strings location, umlaut rule).
**Acceptance:** no English UI text remains (grep the list from Step 0), builds clean, hint toast works.

## Phase B — Difficulty
1. New migration `supabase/migrations/<ts>_add_difficulty.sql`: `ALTER TABLE public.puzzles ADD COLUMN difficulty text NOT NULL DEFAULT 'easy' CHECK (difficulty IN ('easy','medium','hard'));` Add a comment that it must be applied before deploying the code that selects it.
2. `lib/crossword.ts`: `PuzzleRow`/`PuzzleData` get `difficulty`; `mapPuzzle` validates it (fall back to `easy` with a warn if missing). `usePuzzles` selects it.
3. Browse: second filter row (Alle / Leicht / Mittel / Schwer), combinable with the category tabs; a "nur ungelöste" toggle. Cards and the play header show a difficulty tag (reuse `CategoryTag` styling; add `DifficultyTag` in `PuzzleBits.tsx`).
4. `scripts/validate-puzzles.mjs`: accept and check `difficulty`; also **reject any answer or grid letter that isn't A–Z** (so ä/ö/ü/ß can never get in).
5. Continue-card logic stays "lowest `order_index` not completed". Document the intended ordering convention in CLAUDE.md: order by size then difficulty (9 easy → 9 medium → ... ) so Continue walks a sensible path.
**Acceptance:** filters work and combine; a puzzle with `difficulty` missing doesn't crash.

## Phase C — Generator pipeline (no puzzles published yet)
All code in `scripts/gen/`, plain Node ESM, no dependencies. Outputs go to `puzzles/` (git-tracked, drafts) — never into the app bundle.
1. **Word list prep** (`scripts/gen/build-wordlist.mjs`): the user supplies a raw German word list and, ideally, a frequency list. **Ask which sources before choosing and report their licenses** (candidates to check: Hunspell `de_DE` dictionaries; Leipzig Wortschatz frequency lists). Normalize: uppercase, ä→AE etc., ß→SS, drop anything not A–Z after that, length 3–15, dedupe. Output `data/wordlist-de.txt` as `WORD<TAB>score` where score is a frequency rank bucket (1 common … 5 rare). Drop obvious junk (abbreviations, single-letter repeats like "AAAA"). Keep proper nouns in a separate list `data/names-de.txt` that only *hard* puzzles may use. Commit the filtered list only if its license allows; otherwise gitignore it and document the build step.
2. **Block patterns** (`scripts/gen/patterns.mjs`): generate symmetric (180° rotational) patterns per size: min word length 3, no isolated/unconnected white regions, no 2×2 blocks of blocks, block density ≈ 15–22%. Target ~20 patterns per size; save as JSON and eyeball a text render.
3. **Filler** (`scripts/gen/fill.mjs`): backtracking with most-constrained-slot-first and forward checking (per-length index with letter-at-position buckets). Per-attempt time limit (e.g. 20s for 9×9, 60s for 15×15), random restarts, seeded RNG (`--seed`). Options: `--size`, `--difficulty` (easy: only score ≤2 words; medium ≤4; hard: all plus names list), `--avoid-words <file>` and a global usage counter so no answer repeats within a puzzle and overused answers are penalized across the collection.
4. **Draft format** (`puzzles/draft/<id>.json`): `{ id, title: "", puzzle_type: "standard", difficulty, width, height, grid: [...flat, "#" blocked...], entries: [{ number, direction, row, col, answer, clue: "", confidence: "" }] }`. Numbering must use the same canonical rule as `lib/crossword.ts` (import it; don't reimplement).
5. **Assemble** (`scripts/gen/assemble.mjs`): turns approved drafts (all clues non-empty) into `puzzles` rows (`clues: {across:[...], down:[...]}` with `number,text,answer,row,col`) in `puzzles/ready/*.json`, runs the validator logic, and writes `supabase/seed/<ts>_<batch>.sql` using `INSERT ... ON CONFLICT (id) DO NOTHING` (never DO UPDATE on grid). `order_index` assigned per the convention in Phase B.
6. Produce **5 draft grids** (one per: 9 easy, 9 medium, 12 easy, 12 hard, 15 medium) and print them as text with their word lists. Stop. **Do not write clues yet.**
**Acceptance:** drafts validate structurally; no word repeats within a puzzle; fill succeeds within the time limits for all three sizes; hard puzzles actually contain rarer words/names than easy ones (report the average score per tier).

## Phase D — Clues and batches
1. Write `docs/clue-style-de.md` defining the tiers: **easy** (direct definition, one common meaning, 1–4 words), **medium** (indirect/figurative, synonyms, light wordplay, general knowledge), **hard** (oblique, multi-step or misleading-surface clues, rarer words, names, cultural references; real cryptics only if you are certain the wordplay is correct). Rules: never include the answer or its stem in the clue; match part of speech and number/inflection; German spelling in clues (use ä/ö/ü/ß normally there); no clue that only works with the umlaut spelling ambiguity (e.g. avoid answers that can read as two different words after AE/OE/UE collapse).
2. Fill clues for the 5 pilot drafts. For every clue set `confidence`: `sure` or `check`. Anything involving a fact, name or date that you can't verify from the word itself gets `check`.
3. **Verification pass:** in a *fresh* session (no memory of writing the clues), read each draft, answer each clue blind, and compare with the intended answer; use WebSearch for every `check` item. Output a report of mismatches. Fix clues (never grids).
4. The user reviews the 5 pilots. Only then scale in batches of ~5 puzzles per session toward the target list in `03-your-checklist.md`, commit per batch.
5. Titles: short, German, not numbered ("Morgenkaffee", "Auf Reisen"); derive from the theme only if the grid has one; otherwise a pleasant neutral title. No duplicates.
**Acceptance:** blind-solve accuracy ≥ 98% on easy/medium, every `check` item resolved or removed, validator passes, user approves the pilots.

## Phase E — Custom puzzles (later, only when the user has family material)
`scripts/gen/custom.mjs`: input a list of `{answer, clue}` pairs (plus optional author name and congrats message), build a small interlocking grid around them (this is word-placement, not dense fill; accept sparse grids and blocks), output a draft in the same format with `puzzle_type: "custom"`, `author_name`, `congrats_message`. Same validator and seed path. Until then the user can bring pairs to chat and Claude builds them by hand.

## Rules that apply across phases
- Do not touch the service worker, auth, or the first-clear trigger.
- Never print or read `.env*`.
- Update `CLAUDE.md` whenever a phase changes something it describes.
