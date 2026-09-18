# Bug Report & Implementation Plan

Repo state reviewed: `Senshasan/crossword-pwa` @ `main`. Data reviewed: `puzzles_rows.csv` (3 standard puzzles, live in Supabase).

---

## Root Cause (covers BUG-1 through BUG-4)

`app/globals.css` is **stale**. It is 21 lines and still describes the original v0 prototype, not the current `PlayScreen`. It defines classes the app no longer uses, and is missing classes the app *does* use.

**Used in `app/page.tsx`, but no CSS rule exists anywhere:**

| Class | Where used | Visible symptom |
|---|---|---|
| `keyboard-input` | hidden letter input | renders as a visible empty input box (BUG-1) |
| `blocked` | `.cell.blocked` | blocked cells look identical to empty ones (BUG-2) |
| `word-active` | `.cell.word-active` | active word isn't highlighted, only the single cursor cell |
| `clue-tabs` | Across/Down tab row | renders as run-together text "AcrossDown" (BUG-4) |
| `clue-list` | clue list container | no spacing/scroll |
| `sticky-clue` | active clue bar | no visual separation from the list |
| `success-modal` | victory modal | **unstyled — not yet noticed because no puzzle has been solved yet** |
| `continue-card` | home "Continue" card | unstyled |
| `play-circle` | Continue card chevron | unstyled |
| `real-grid` | grid container | no effect (may be intentional) |

**Dead rules to delete (leftovers from the replaced prototype):** `.keyboard`, `.keyboard button`, `.wide-key`, `.success-banner`, `.install-modal`, `.family-strip`, `.family-icon`, `.cell.filled`, `.mini-grid.blue`, `.mini-grid.gold`, `.text-accent`.

Because of this, **the single highest-value action is rewriting `globals.css` against the current markup** rather than patching individual symptoms.

---

## BUG-1 — Mystery empty box under the puzzle title

**Severity:** High (looks broken, invites stray clicks)

**Cause:** In `PlayScreen`, the hidden letter-capture input is rendered directly after `.play-header`:

```tsx
<input ref={inputRef} className="keyboard-input" autoFocus ... />
```

`.keyboard-input` has no CSS rule, so it renders as a default browser input with the app's border styling. It is *not* an author byline placeholder — it's the mechanism that summons the mobile keyboard.

**Fix:** Add a rule that hides it visually while keeping it focusable and keyboard-summoning on iOS. It must **not** use `display:none`, `visibility:hidden`, or `width/height: 0` — iOS won't open the keyboard for an input it considers non-rendered.

```css
.keyboard-input {
  position: absolute;
  opacity: 0;
  width: 1px;
  height: 1px;
  padding: 0;
  border: 0;
  font-size: 16px;      /* must stay 16px — prevents iOS zoom-on-focus */
  pointer-events: none;
  z-index: -1;
}
```

**Verify:** box is gone; tapping a cell on a real iPhone still opens the keyboard and typing still fills cells.

---

## BUG-2 — Blocked cells indistinguishable from empty cells

**Severity:** High (puzzle is not solvable as intended — the user can't see the shape)

**Cause:** `.cell.blocked` has no rule. `mapPuzzle` correctly sets `isBlocked` for `#` cells and the JSX correctly applies the class; only the styling is missing.

**Fix:**

```css
.cell.blocked {
  background: var(--foreground);
  border-radius: 0;
  pointer-events: none;
}
```

Since `.crossword-grid` already uses `background: var(--foreground)` for its gridlines, this makes blocked cells merge seamlessly into the grid frame — the standard crossword look. `pointer-events: none` also removes them from the click/tab surface.

**Also add the missing active-word highlight** (spec'd originally, never styled):

```css
.cell.word-active { background: #e6eee8; color: #27372d; }
```

---

## BUG-3 — Typed letter collides with the clue number in the same cell

**Severity:** High (illegible on any numbered cell)

**Cause:** `.cell` is `display: grid; place-items: center`, and the number is emitted as a bare `<small>` sibling of the letter text. Both land in the same centered grid area and overlap.

**Fix:** Make the cell a positioning context, absolutely position the number into the top-left corner, and give the letter its own centered layer so its box is unaffected by the number's presence.

```css
.cell { position: relative; }
.cell small {
  position: absolute;
  top: 2px;
  left: 4px;
  font-size: clamp(9px, 1.4vw, 12px);
  font-weight: 700;
  line-height: 1;
  opacity: .75;
  pointer-events: none;
}
```

**Verify:** compare a numbered cell (e.g. H in "The Basics") against an unnumbered one — the letter must sit at identical size and position in both.

---

## BUG-4 — Clue list: "AcrossDown" artifact, one direction at a time, no direction indicator

**Severity:** Medium-High

**Three separate problems:**

1. **"AcrossDown"** — the `.clue-tabs` wrapper has no CSS, so the two `<button>`s render inline with no gap or tab styling.
2. **Only one direction's clues are listed** — by design: `active.clues[direction].map(...)` renders only the active direction. Combined with invisible tabs, this reads as "missing clues."
3. **No direction indicator per clue** — `.clue-row` shows only number + text.

**Fix (implements your requested design):** drop the tab row entirely, render **all** clues in one list, and mark direction with a lucide arrow icon per row.

- In `PlayScreen`, replace the `.clue-tabs` block and the single-direction list with a merged list:

```tsx
{[...active.clues.across, ...active.clues.down]
  .map((clue: Clue) => (
    <button
      key={`${clue.direction}-${clue.number}`}
      className={`clue-row ${activeClue?.number === clue.number && activeClue?.direction === clue.direction ? 'active' : ''}`}
      onClick={() => onClue(clue)}
    >
      <span className="clue-number">{clue.number}</span>
      <span className="clue-dir" aria-label={clue.direction}>
        {clue.direction === 'across' ? <ArrowRight size={14} /> : <ArrowDown size={14} />}
      </span>
      <span>{clue.text}</span>
    </button>
  ))}
```

- Import `ArrowRight, ArrowDown` from `lucide-react`.
- `onDirection` becomes unused by the list — keep it, it's still needed for the cell-tap direction toggle.
- Sort the merged list by `number`, then across-before-down, so it reads in conventional crossword order.
- Style `.clue-list` (spacing, `max-height` + `overflow-y: auto`), `.clue-row.active` (highlight the current clue), and `.clue-dir` (muted icon color).
- Give `.sticky-clue` its own direction icon too, so the active clue bar states across/down without relying on the list.

**Note:** this also removes the need for BUG-4's tabs *and* resolves the deferred "no prev/next `<`/`>` buttons" item partially — but prev/next is still worth adding separately later.

---

## BUG-5 — Avatar button signs the user out instantly

**Severity:** High (destructive, one accidental tap forces a full re-auth via emailed code)

**Cause:** `app/page.tsx` header:

```tsx
<button className="avatar" onClick={() => supabase.auth.signOut()} aria-label="Sign out">
```

No confirmation, no menu. Given OTP re-auth requires waiting for an email, an accidental tap is genuinely costly — this directly undermines the low-friction auth design.

**Fix (your preferred option):** turn the avatar into an account popover.

- Add `const [menuOpen, setMenuOpen] = useState(false)` to `Page`.
- Avatar `onClick` toggles `menuOpen` instead of signing out.
- Render a popover containing:
  - display name (already in `name` state)
  - email — available as `user.email`, no extra query needed
  - a clearly-separated "Sign out" button that calls `supabase.auth.signOut()`
- Close on outside click (`useEffect` + `document.addEventListener('pointerdown', ...)`) and on `Escape`.
- Add `.account-menu` CSS: absolutely positioned under the avatar, `var(--card)` background, border, radius, shadow, `z-index` above the hero.
- Accessibility: `aria-haspopup="menu"`, `aria-expanded={menuOpen}`, and change `aria-label` from "Sign out" to "Account".

**Consider also:** a `confirm()` or a second-click confirm on the sign-out button itself, since re-auth is expensive.

---

## BUG-6 — Duplicate clue numbers in "Interlocking" *(data bug, found during review)*

**Severity:** Medium (puzzle is solvable but the numbering is wrong and ambiguous)

**Found by:** recomputing canonical crossword numbering from the grid independently and diffing against the CSV.

Grid:

```
M U S I C
A # T # A
T R A I N
C # M # D
H A P P Y
```

Canonical numbering assigns a number to each cell that starts an across *or* down entry, scanning left-to-right, top-to-bottom: `(0,0)=1`, `(0,2)=2`, `(0,4)=3`, `(2,0)=4`, `(4,0)=5`.

| Clue | CSV number | Correct number |
|---|---|---|
| across MUSIC (0,0) | 1 | 1 ✓ |
| across TRAIN (2,0) | 2 | **4** |
| across HAPPY (4,0) | 3 | **5** |
| down MATCH (0,0) | 1 | 1 ✓ |
| down STAMP (0,2) | 2 | 2 ✓ |
| down CANDY (0,4) | 3 | 3 ✓ |

**Symptom:** `mapPuzzle` builds `numberByStart` keyed by `row:col`, so cells `(0,2)` and `(2,0)` both render "2", and `(0,4)` and `(4,0)` both render "3".

**Fix:** update the `clues` JSON for the "Interlocking" row in Supabase — across TRAIN `number: 4`, across HAPPY `number: 5`.

**"The Basics" and "Media & Minds" numbering verified correct — no change needed.**

---

## BUG-7 — `validatePuzzleData` can't catch numbering errors *(latent)*

**Severity:** Medium (will keep biting as puzzles are hand-entered)

All three puzzles pass `validatePuzzleData` today, **including the mis-numbered "Interlocking"**. The validator checks that answers match grid letters, that intersections agree, and that a numbered cell has *some* matching clue — but it never verifies that numbers follow canonical crossword ordering, so BUG-6 sailed through.

**Fix:** add a numbering check to `lib/crossword.ts`:

1. Scan the grid left-to-right, top-to-bottom.
2. A cell starts an across entry if (it's at col 0 or its left neighbour is blocked) **and** its right neighbour exists and is open.
3. Same logic vertically for down entries.
4. Increment a counter at each such cell; that's its canonical number.
5. Error if a clue's declared `number` differs from the canonical number for its `(row, col)`.
6. Error if two *different* cells resolve to the same displayed number.

This is high-value because you're hand-entering every puzzle — it converts a silent visual bug into a loud console error via the existing `console.warn` path in `mapPuzzle`.

---

## BUG-8 — Minor issues *(low priority)*

- **`PuzzleCard` mini-grid:** `.mini-grid` is `grid-template-columns: repeat(3, 1fr)` but renders `puzzle.grid[0]` (5 cells for a 5-wide puzzle), so the preview wraps to 2 rows. Either slice to 3 cells or make the column count dynamic.
- **`nextPuzzle.clues.across[0].text` will throw** if a puzzle ever has zero across clues (valid for a down-only puzzle). Guard with `?.text ?? ''`. Same pattern in `PuzzleCard`.
- **Blocked cells are focusable buttons.** `focusCell` early-returns for them, but they're still in the tab order. `pointer-events: none` (BUG-2) plus `tabIndex={-1}` / `disabled` fixes this for keyboard and screen-reader users.
- **Deferred, still open:** no `<`/`>` prev/next buttons on the active clue bar; `author_name` / `congrats_message` still absent from the migration and the `.select()`, so custom-puzzle messages will render blank.

---

## Suggested Implementation Order

1. **Rewrite `app/globals.css`** against current markup — fixes BUG-1, BUG-2, BUG-3, the unstyled victory modal, and half of BUG-4 in one pass. Delete the dead rules while there.
2. **BUG-6** — one-row Supabase edit, unblocks correct display of "Interlocking" immediately.
3. **BUG-5** — account popover; self-contained, high user-facing value.
4. **BUG-4** — merged clue list with direction arrows; the only change needing real JSX restructuring.
5. **BUG-7** — numbering validation; do this before entering the next batch of puzzles, not after.
6. **BUG-8** — cleanup pass.

Steps 1–4 are independent of each other and can be done in any order or in parallel.
