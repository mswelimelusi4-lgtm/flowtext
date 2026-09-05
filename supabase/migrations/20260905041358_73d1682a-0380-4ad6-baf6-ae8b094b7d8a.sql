DROP POLICY "posts_select" ON public.posts;
DROP POLICY "posts_insert" ON public.posts;
DROP POLICY "comments_select" ON public.comments;
DROP POLICY "comments_insert" ON public.comments;

CREATE POLICY "posts_select" ON public.posts FOR SELECT TO authenticated USING (
  author_id = auth.uid()
  OR (group_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.group_members m
        WHERE m.group_id = posts.group_id AND m.user_id = auth.uid()))
  OR (group_id IS NULL AND (
        visibility = 'public'
        OR (visibility = 'friends' AND EXISTS (
              SELECT 1 FROM public.friendships f
              WHERE f.status = 'accepted'
                AND ((f.requester_id = auth.uid() AND f.addressee_id = posts.author_id)
                  OR (f.requester_id = posts.author_id AND f.addressee_id = auth.uid()))))
      ))
);

CREATE POLICY "posts_insert" ON public.posts FOR INSERT TO authenticated WITH CHECK (
  author_id = auth.uid()
  AND (group_id IS NULL OR EXISTS (
        SELECT 1 FROM public.group_members m
        WHERE m.group_id = posts.group_id AND m.user_id = auth.uid()))
);

CREATE POLICY "comments_select" ON public.comments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.posts p WHERE p.id = comments.post_id)
);

CREATE POLICY "comments_insert" ON public.comments FOR INSERT TO authenticated WITH CHECK (
  author_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.posts p WHERE p.id = comments.post_id)
);

DROP FUNCTION IF EXISTS public.can_view_post(UUID, UUID);
DROP FUNCTION IF EXISTS public.are_friends(UUID, UUID);
DROP FUNCTION IF EXISTS public.is_group_member(UUID, UUID);
DROP FUNCTION IF EXISTS public.touch_updated_at() CASCADE;

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

REVOKE ALL ON FUNCTION public.is_thread_participant(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_thread_creator(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_thread_participant(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_thread_creator(UUID, UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.bump_thread() FROM PUBLIC, anon, authenticated;