-- Puzzle difficulty, shown as a tag and used by the Browse filter.
--
-- APPLY THIS BEFORE DEPLOYING the code that selects `difficulty` (hooks/usePuzzles.ts).
-- Without the column the whole puzzles query fails and the app shows its load-error screen.
--
-- Existing rows get 'easy'; adjust them afterwards with an UPDATE if needed.
ALTER TABLE public.puzzles
  ADD COLUMN difficulty text NOT NULL DEFAULT 'easy'
  CHECK (difficulty IN ('easy', 'medium', 'hard'));
