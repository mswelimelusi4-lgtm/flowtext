-- 1. Profile columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS current_city text,
  ADD COLUMN IF NOT EXISTS hometown text,
  ADD COLUMN IF NOT EXISTS relationship_status text,
  ADD COLUMN IF NOT EXISTS partner_name text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS interests text,
  ADD COLUMN IF NOT EXISTS favorite_quotes text,
  ADD COLUMN IF NOT EXISTS about_extra text,
  ADD COLUMN IF NOT EXISTS share_avatar_updates boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz,
  ADD COLUMN IF NOT EXISTS default_post_visibility text NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS friends_list_visibility text NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS friend_request_scope text NOT NULL DEFAULT 'everyone',
  ADD COLUMN IF NOT EXISTS lookup_by_email boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS lookup_by_phone boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS two_factor_enabled boolean NOT NULL DEFAULT false;

-- 2. Work and education
CREATE TABLE IF NOT EXISTS public.profile_experiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'work',
  title text,
  organization text NOT NULL,
  degree text,
  start_date date,
  end_date date,
  is_current boolean NOT NULL DEFAULT false,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_experiences TO authenticated;
GRANT ALL ON public.profile_experiences TO service_role;
ALTER TABLE public.profile_experiences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "experiences_select" ON public.profile_experiences FOR SELECT TO authenticated USING (true);
CREATE POLICY "experiences_insert" ON public.profile_experiences FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "experiences_update" ON public.profile_experiences FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "experiences_delete" ON public.profile_experiences FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER profile_experiences_touch BEFORE UPDATE ON public.profile_experiences FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS profile_experiences_user_idx ON public.profile_experiences(user_id);

-- 3. Places lived
CREATE TABLE IF NOT EXISTS public.profile_places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'other',
  name text NOT NULL,
  year integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_places TO authenticated;
GRANT ALL ON public.profile_places TO service_role;
ALTER TABLE public.profile_places ENABLE ROW LEVEL SECURITY;
CREATE POLICY "places_select" ON public.profile_places FOR SELECT TO authenticated USING (true);
CREATE POLICY "places_insert" ON public.profile_places FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "places_update" ON public.profile_places FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "places_delete" ON public.profile_places FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS profile_places_user_idx ON public.profile_places(user_id);

-- 4. Family members
CREATE TABLE IF NOT EXISTS public.family_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  relative_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  relationship text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, relative_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_members TO authenticated;
GRANT ALL ON public.family_members TO service_role;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "family_select" ON public.family_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "family_insert" ON public.family_members FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND relative_id <> auth.uid());
CREATE POLICY "family_update" ON public.family_members FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "family_delete" ON public.family_members FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 5. Life events
CREATE TABLE IF NOT EXISTS public.life_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  event_date date NOT NULL,
  description text,
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.life_events TO authenticated;
GRANT ALL ON public.life_events TO service_role;
ALTER TABLE public.life_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "life_events_select" ON public.life_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "life_events_insert" ON public.life_events FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "life_events_update" ON public.life_events FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "life_events_delete" ON public.life_events FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS life_events_user_idx ON public.life_events(user_id, event_date DESC);

-- 6. Profile / cover photo history
CREATE TABLE IF NOT EXISTS public.profile_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'avatar',
  url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_photos TO authenticated;
GRANT ALL ON public.profile_photos TO service_role;
ALTER TABLE public.profile_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profile_photos_select" ON public.profile_photos FOR SELECT TO authenticated USING (true);
CREATE POLICY "profile_photos_insert" ON public.profile_photos FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "profile_photos_delete" ON public.profile_photos FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS profile_photos_user_idx ON public.profile_photos(user_id, created_at DESC);

-- 7. Private contact / basic info
CREATE TABLE IF NOT EXISTS public.profile_private (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  phone text,
  contact_email text,
  birthday date,
  gender text,
  languages text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_private TO authenticated;
GRANT ALL ON public.profile_private TO service_role;
ALTER TABLE public.profile_private ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profile_private_select" ON public.profile_private FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "profile_private_insert" ON public.profile_private FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "profile_private_update" ON public.profile_private FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "profile_private_delete" ON public.profile_private FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER profile_private_touch BEFORE UPDATE ON public.profile_private FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 8. Blocked users
CREATE TABLE IF NOT EXISTS public.blocked_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id)
);
GRANT SELECT, INSERT, DELETE ON public.blocked_users TO authenticated;
GRANT ALL ON public.blocked_users TO service_role;
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blocked_select" ON public.blocked_users FOR SELECT TO authenticated USING (blocker_id = auth.uid());
CREATE POLICY "blocked_insert" ON public.blocked_users FOR INSERT TO authenticated WITH CHECK (blocker_id = auth.uid() AND blocked_id <> auth.uid());
CREATE POLICY "blocked_delete" ON public.blocked_users FOR DELETE TO authenticated USING (blocker_id = auth.uid());

-- 9. Notification preferences
CREATE TABLE IF NOT EXISTS public.notification_prefs (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  on_comment boolean NOT NULL DEFAULT true,
  on_like boolean NOT NULL DEFAULT true,
  on_friend_request boolean NOT NULL DEFAULT true,
  on_message boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_prefs TO authenticated;
GRANT ALL ON public.notification_prefs TO service_role;
ALTER TABLE public.notification_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_prefs_select" ON public.notification_prefs FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notif_prefs_insert" ON public.notification_prefs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "notif_prefs_update" ON public.notification_prefs FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER notification_prefs_touch BEFORE UPDATE ON public.notification_prefs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 10. Signed-in devices
CREATE TABLE IF NOT EXISTS public.user_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Browser',
  user_agent text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_devices TO authenticated;
GRANT ALL ON public.user_devices TO service_role;
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "devices_select" ON public.user_devices FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "devices_insert" ON public.user_devices FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "devices_update" ON public.user_devices FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "devices_delete" ON public.user_devices FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS user_devices_user_idx ON public.user_devices(user_id, last_seen_at DESC);