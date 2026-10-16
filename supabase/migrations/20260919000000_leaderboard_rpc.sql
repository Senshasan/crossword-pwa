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
