CREATE OR REPLACE FUNCTION public.are_friends(a uuid, b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships f
    WHERE f.status = 'accepted'
      AND ((f.requester_id = a AND f.addressee_id = b) OR (f.requester_id = b AND f.addressee_id = a))
  );
$$;
REVOKE ALL ON FUNCTION public.are_friends(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.are_friends(uuid, uuid) TO authenticated, service_role;

CREATE TABLE public.stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'photo' CHECK (kind IN ('photo','video','text')),
  media_url text,
  caption text,
  background text NOT NULL DEFAULT '#1f2933',
  text_color text NOT NULL DEFAULT '#ffffff',
  overlays jsonb NOT NULL DEFAULT '[]'::jsonb,
  drawing text,
  duration_ms integer NOT NULL DEFAULT 5000,
  visibility text NOT NULL DEFAULT 'friends' CHECK (visibility IN ('public','friends')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);
CREATE INDEX stories_author_created_idx ON public.stories (author_id, created_at DESC);
CREATE INDEX stories_expires_idx ON public.stories (expires_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stories TO authenticated;
GRANT ALL ON public.stories TO service_role;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.story_excludes (
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.story_excludes TO authenticated;
GRANT ALL ON public.story_excludes TO service_role;
ALTER TABLE public.story_excludes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.story_views (
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, user_id)
);
CREATE INDEX story_views_user_idx ON public.story_views (user_id);
GRANT SELECT, INSERT ON public.story_views TO authenticated;
GRANT ALL ON public.story_views TO service_role;
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_see_story(sid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.stories s
    WHERE s.id = sid
      AND (
        s.author_id = auth.uid()
        OR (
          s.expires_at > now()
          AND (s.visibility = 'public' OR public.are_friends(s.author_id, auth.uid()))
          AND NOT EXISTS (
            SELECT 1 FROM public.story_excludes x
            WHERE x.story_id = s.id AND x.user_id = auth.uid()
          )
        )
      )
  );
$$;
REVOKE ALL ON FUNCTION public.can_see_story(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_see_story(uuid) TO authenticated, service_role;

CREATE POLICY "stories visible to allowed viewers" ON public.stories FOR SELECT TO authenticated
USING (
  author_id = auth.uid()
  OR (
    expires_at > now()
    AND (visibility = 'public' OR public.are_friends(author_id, auth.uid()))
    AND NOT EXISTS (
      SELECT 1 FROM public.story_excludes x WHERE x.story_id = stories.id AND x.user_id = auth.uid()
    )
  )
);
CREATE POLICY "authors create own stories" ON public.stories FOR INSERT TO authenticated
WITH CHECK (author_id = auth.uid());
CREATE POLICY "authors update own stories" ON public.stories FOR UPDATE TO authenticated
USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
CREATE POLICY "authors delete own stories" ON public.stories FOR DELETE TO authenticated
USING (author_id = auth.uid());

CREATE POLICY "authors manage story excludes" ON public.story_excludes FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id AND s.author_id = auth.uid()));
CREATE POLICY "authors add story excludes" ON public.story_excludes FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id AND s.author_id = auth.uid()));
CREATE POLICY "authors remove story excludes" ON public.story_excludes FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id AND s.author_id = auth.uid()));

CREATE POLICY "viewers and authors read views" ON public.story_views FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id AND s.author_id = auth.uid())
);
CREATE POLICY "viewers record own view" ON public.story_views FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND public.can_see_story(story_id));