CREATE OR REPLACE FUNCTION public.is_story_excluded(_story_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.story_excludes x
    WHERE x.story_id = _story_id
      AND x.user_id = _user_id
  );
$$;

REVOKE ALL ON FUNCTION public.is_story_excluded(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_story_excluded(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.owns_story(_story_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.stories s
    WHERE s.id = _story_id
      AND s.author_id = _user_id
  );
$$;

REVOKE ALL ON FUNCTION public.owns_story(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owns_story(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "stories visible to allowed viewers" ON public.stories;
CREATE POLICY "stories visible to allowed viewers"
ON public.stories
FOR SELECT
TO authenticated
USING (
  author_id = auth.uid()
  OR (
    expires_at > now()
    AND (visibility = 'public' OR public.are_friends(author_id, auth.uid()))
    AND NOT public.is_story_excluded(id, auth.uid())
  )
);

DROP POLICY IF EXISTS "authors manage story excludes" ON public.story_excludes;
CREATE POLICY "authors manage story excludes"
ON public.story_excludes
FOR SELECT
TO authenticated
USING (public.owns_story(story_id, auth.uid()));

DROP POLICY IF EXISTS "authors add story excludes" ON public.story_excludes;
CREATE POLICY "authors add story excludes"
ON public.story_excludes
FOR INSERT
TO authenticated
WITH CHECK (public.owns_story(story_id, auth.uid()));

DROP POLICY IF EXISTS "authors remove story excludes" ON public.story_excludes;
CREATE POLICY "authors remove story excludes"
ON public.story_excludes
FOR DELETE
TO authenticated
USING (public.owns_story(story_id, auth.uid()));

DROP POLICY IF EXISTS "viewers and authors read views" ON public.story_views;
CREATE POLICY "viewers and authors read views"
ON public.story_views
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.owns_story(story_id, auth.uid())
);