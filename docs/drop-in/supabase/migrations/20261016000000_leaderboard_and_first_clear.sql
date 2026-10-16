-- 1) FIRST CLEAR IS PERMANENT -------------------------------------------------
-- Once a puzzle is completed, the client can no longer un-complete it or change
-- its recorded time/date. Without this, Check Grid / Reset on a solved puzzle
-- (which save completed=false) would erase the completion, and re-opening a
-- solved puzzle would keep overwriting solve_time_seconds.
CREATE OR REPLACE FUNCTION public.keep_first_clear()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.completed THEN
    NEW.completed          := true;
    NEW.completed_at       := OLD.completed_at;
    NEW.solve_time_seconds := OLD.solve_time_seconds;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS puzzle_progress_keep_first_clear ON public.puzzle_progress;
CREATE TRIGGER puzzle_progress_keep_first_clear
  BEFORE UPDATE ON public.puzzle_progress
  FOR EACH ROW EXECUTE FUNCTION public.keep_first_clear();

-- Backfill is intentionally not attempted: rows already flipped back to
-- completed=false by the old behaviour cannot be recovered automatically.

-- 2) LEADERBOARD --------------------------------------------------------------
-- RLS only lets users read their own rows, so the aggregate runs as SECURITY
-- DEFINER and returns nothing but display name + count. No emails, no ids,
-- no per-puzzle data leave the database.
-- Ranking: most puzzles completed; ties go to whoever reached that count first.
CREATE OR REPLACE FUNCTION public.get_leaderboard(limit_count int DEFAULT 3)
RETURNS TABLE (display_name text, completed_count bigint, is_me boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.display_name,
         COUNT(*)            AS completed_count,
         (p.id = auth.uid()) AS is_me
  FROM public.profiles p
  JOIN public.puzzle_progress pp
    ON pp.user_id = p.id AND pp.completed
  GROUP BY p.id, p.display_name
  ORDER BY completed_count DESC, MAX(pp.completed_at) ASC
  LIMIT GREATEST(1, LEAST(limit_count, 10));
$$;

REVOKE ALL ON FUNCTION public.get_leaderboard(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(int) TO authenticated;
