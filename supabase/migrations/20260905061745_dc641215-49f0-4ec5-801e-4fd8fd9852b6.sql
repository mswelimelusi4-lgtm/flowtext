-- 1. Comments: mirror post visibility for reading and writing comments
DROP POLICY IF EXISTS comments_select ON public.comments;
CREATE POLICY comments_select ON public.comments FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = comments.post_id
      AND (
        p.author_id = auth.uid()
        OR (p.group_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.group_members m
          WHERE m.group_id = p.group_id AND m.user_id = auth.uid()))
        OR (p.group_id IS NULL AND (
          p.visibility = 'public'
          OR (p.visibility = 'friends' AND public.are_friends(p.author_id, auth.uid()))))
      )
  )
);

DROP POLICY IF EXISTS comments_insert ON public.comments;
CREATE POLICY comments_insert ON public.comments FOR INSERT TO authenticated WITH CHECK (
  author_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = comments.post_id
      AND (
        p.author_id = auth.uid()
        OR (p.group_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.group_members m
          WHERE m.group_id = p.group_id AND m.user_id = auth.uid()))
        OR (p.group_id IS NULL AND (
          p.visibility = 'public'
          OR (p.visibility = 'friends' AND public.are_friends(p.author_id, auth.uid()))))
      )
  )
);

-- 2. Friendships: only the two people involved, and accepted friendships are
-- visible to friends of either party (for mutual-friend friend lists)
DROP POLICY IF EXISTS friendships_select ON public.friendships;
CREATE POLICY friendships_select ON public.friendships FOR SELECT TO authenticated USING (
  requester_id = auth.uid()
  OR addressee_id = auth.uid()
  OR (status = 'accepted' AND (
    public.are_friends(requester_id, auth.uid())
    OR public.are_friends(addressee_id, auth.uid())
  ))
);

-- 3. Profile subtables: owner and friends only
DROP POLICY IF EXISTS experiences_select ON public.profile_experiences;
CREATE POLICY experiences_select ON public.profile_experiences FOR SELECT TO authenticated USING (
  user_id = auth.uid() OR public.are_friends(user_id, auth.uid())
);

DROP POLICY IF EXISTS places_select ON public.profile_places;
CREATE POLICY places_select ON public.profile_places FOR SELECT TO authenticated USING (
  user_id = auth.uid() OR public.are_friends(user_id, auth.uid())
);

DROP POLICY IF EXISTS profile_photos_select ON public.profile_photos;
CREATE POLICY profile_photos_select ON public.profile_photos FOR SELECT TO authenticated USING (
  user_id = auth.uid() OR public.are_friends(user_id, auth.uid())
);

DROP POLICY IF EXISTS life_events_select ON public.life_events;
CREATE POLICY life_events_select ON public.life_events FOR SELECT TO authenticated USING (
  user_id = auth.uid() OR public.are_friends(user_id, auth.uid())
);

DROP POLICY IF EXISTS family_select ON public.family_members;
CREATE POLICY family_select ON public.family_members FOR SELECT TO authenticated USING (
  user_id = auth.uid()
  OR relative_id = auth.uid()
  OR public.are_friends(user_id, auth.uid())
);

-- 4. Storage: read media only if it's yours or attached to content you can see
DROP POLICY IF EXISTS media_read_authenticated ON storage.objects;
CREATE POLICY media_read_scoped ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'media'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    -- profile avatars and covers are public within the app
    OR EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.avatar_url LIKE '%' || name OR pr.cover_url LIKE '%' || name)
    -- media attached to posts the viewer can see
    OR EXISTS (
      SELECT 1 FROM public.posts p
      WHERE EXISTS (SELECT 1 FROM unnest(p.media_urls) u WHERE u LIKE '%' || name)
        AND (
          p.author_id = auth.uid()
          OR (p.group_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.group_members m
            WHERE m.group_id = p.group_id AND m.user_id = auth.uid()))
          OR (p.group_id IS NULL AND (
            p.visibility = 'public'
            OR (p.visibility = 'friends' AND public.are_friends(p.author_id, auth.uid()))))
        ))
    -- message attachments inside threads the viewer belongs to
    OR EXISTS (
      SELECT 1 FROM public.messages msg
      WHERE msg.media_url LIKE '%' || name AND public.in_thread(msg.thread_id))
    -- story media the viewer is allowed to see
    OR EXISTS (
      SELECT 1 FROM public.stories s
      WHERE s.media_url LIKE '%' || name AND public.can_see_story(s.id))
    -- profile photo history / life event photos visible to owner and friends
    OR EXISTS (
      SELECT 1 FROM public.profile_photos pp
      WHERE pp.url LIKE '%' || name
        AND (pp.user_id = auth.uid() OR public.are_friends(pp.user_id, auth.uid())))
    OR EXISTS (
      SELECT 1 FROM public.life_events le
      WHERE le.photo_url LIKE '%' || name
        AND (le.user_id = auth.uid() OR public.are_friends(le.user_id, auth.uid())))
    -- group covers and page avatars are public within the app
    OR EXISTS (SELECT 1 FROM public.groups g WHERE g.cover_url LIKE '%' || name)
    OR EXISTS (SELECT 1 FROM public.pages pg WHERE pg.avatar_url LIKE '%' || name)
    -- group chat photos for members of the thread
    OR EXISTS (
      SELECT 1 FROM public.threads t
      WHERE t.photo_url LIKE '%' || name AND public.in_thread(t.id))
  )
);