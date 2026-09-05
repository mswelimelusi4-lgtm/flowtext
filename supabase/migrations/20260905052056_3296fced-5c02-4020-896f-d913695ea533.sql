-- preferences: extra categories + delivery methods
ALTER TABLE public.notification_prefs
  ADD COLUMN IF NOT EXISTS on_group_activity boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS on_reminder boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS delivery_like text NOT NULL DEFAULT 'push',
  ADD COLUMN IF NOT EXISTS delivery_comment text NOT NULL DEFAULT 'push',
  ADD COLUMN IF NOT EXISTS delivery_friend_request text NOT NULL DEFAULT 'push',
  ADD COLUMN IF NOT EXISTS delivery_message text NOT NULL DEFAULT 'push',
  ADD COLUMN IF NOT EXISTS delivery_group_activity text NOT NULL DEFAULT 'push';

-- muted sources (a post or a person)
CREATE TABLE IF NOT EXISTS public.notification_mutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('post','actor')),
  target_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, target_id)
);

GRANT SELECT, INSERT, DELETE ON public.notification_mutes TO authenticated;
GRANT ALL ON public.notification_mutes TO service_role;

ALTER TABLE public.notification_mutes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own mutes select" ON public.notification_mutes;
CREATE POLICY "own mutes select" ON public.notification_mutes
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "own mutes insert" ON public.notification_mutes;
CREATE POLICY "own mutes insert" ON public.notification_mutes
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "own mutes delete" ON public.notification_mutes;
CREATE POLICY "own mutes delete" ON public.notification_mutes
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- core emitter, respects prefs + mutes
CREATE OR REPLACE FUNCTION public.emit_notification(
  _user_id uuid,
  _actor_id uuid,
  _type text,
  _target_id uuid,
  _body text,
  _pref_column text DEFAULT NULL,
  _mute_post uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowed boolean := true;
BEGIN
  IF _user_id IS NULL OR _user_id = _actor_id THEN RETURN; END IF;

  IF _pref_column IS NOT NULL THEN
    EXECUTE format(
      'SELECT coalesce((SELECT %I FROM public.notification_prefs WHERE user_id = $1), true)',
      _pref_column
    ) INTO allowed USING _user_id;
    IF NOT allowed THEN RETURN; END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.notification_mutes m
    WHERE m.user_id = _user_id
      AND ((m.kind = 'actor' AND m.target_id = _actor_id)
        OR (m.kind = 'post' AND _mute_post IS NOT NULL AND m.target_id = _mute_post))
  ) THEN RETURN; END IF;

  IF EXISTS (
    SELECT 1 FROM public.blocked_users b
    WHERE (b.blocker_id = _user_id AND b.blocked_id = _actor_id)
       OR (b.blocker_id = _actor_id AND b.blocked_id = _user_id)
  ) THEN RETURN; END IF;

  INSERT INTO public.notifications (user_id, actor_id, type, target_id, body)
  VALUES (_user_id, _actor_id, _type, _target_id, _body);
END;
$$;

REVOKE ALL ON FUNCTION public.emit_notification(uuid, uuid, text, uuid, text, text, uuid) FROM anon, authenticated;

-- reactions on posts and comments
CREATE OR REPLACE FUNCTION public.notify_reaction()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner uuid; pid uuid;
BEGIN
  IF NEW.post_id IS NOT NULL THEN
    SELECT author_id INTO owner FROM public.posts WHERE id = NEW.post_id;
    PERFORM public.emit_notification(owner, NEW.user_id, 'reaction', NEW.post_id, NEW.type, 'on_like', NEW.post_id);
  ELSIF NEW.comment_id IS NOT NULL THEN
    SELECT author_id, post_id INTO owner, pid FROM public.comments WHERE id = NEW.comment_id;
    PERFORM public.emit_notification(owner, NEW.user_id, 'comment_reaction', pid, NEW.type, 'on_like', pid);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reactions_notify ON public.reactions;
CREATE TRIGGER reactions_notify AFTER INSERT ON public.reactions
  FOR EACH ROW EXECUTE FUNCTION public.notify_reaction();

-- comments and replies
CREATE OR REPLACE FUNCTION public.notify_comment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE post_owner uuid; parent_owner uuid;
BEGIN
  SELECT author_id INTO post_owner FROM public.posts WHERE id = NEW.post_id;

  IF NEW.parent_comment_id IS NOT NULL THEN
    SELECT author_id INTO parent_owner FROM public.comments WHERE id = NEW.parent_comment_id;
    PERFORM public.emit_notification(parent_owner, NEW.author_id, 'reply', NEW.post_id, NEW.content, 'on_comment', NEW.post_id);
  END IF;

  IF post_owner IS DISTINCT FROM parent_owner THEN
    PERFORM public.emit_notification(post_owner, NEW.author_id, 'comment', NEW.post_id, NEW.content, 'on_comment', NEW.post_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS comments_notify ON public.comments;
CREATE TRIGGER comments_notify AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_comment();

-- friend requests + accepts
CREATE OR REPLACE FUNCTION public.notify_friendship()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'pending' THEN
      PERFORM public.emit_notification(NEW.addressee_id, NEW.requester_id, 'friend_request', NEW.id, NULL, 'on_friend_request', NULL);
    END IF;
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'accepted' AND OLD.status <> 'accepted' THEN
    PERFORM public.emit_notification(NEW.requester_id, NEW.addressee_id, 'friend_accepted', NEW.id, NULL, 'on_friend_request', NULL);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS friendships_notify ON public.friendships;
CREATE TRIGGER friendships_notify AFTER INSERT OR UPDATE ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.notify_friendship();

-- direct/group messages
CREATE OR REPLACE FUNCTION public.notify_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT user_id FROM public.thread_participants
    WHERE thread_id = NEW.thread_id AND user_id <> NEW.sender_id AND muted_at IS NULL
  LOOP
    PERFORM public.emit_notification(r.user_id, NEW.sender_id, 'message', NEW.thread_id, NEW.content, 'on_message', NULL);
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_notify ON public.messages;
CREATE TRIGGER messages_notify AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_message();

-- group activity: new post in a group, new member
CREATE OR REPLACE FUNCTION public.notify_group_post()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  IF NEW.group_id IS NULL THEN RETURN NEW; END IF;
  FOR r IN
    SELECT user_id FROM public.group_members WHERE group_id = NEW.group_id AND user_id <> NEW.author_id
  LOOP
    PERFORM public.emit_notification(r.user_id, NEW.author_id, 'group_post', NEW.id, NEW.content, 'on_group_activity', NEW.id);
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS posts_notify_group ON public.posts;
CREATE TRIGGER posts_notify_group AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.notify_group_post();

CREATE OR REPLACE FUNCTION public.notify_group_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; gname text;
BEGIN
  SELECT name INTO gname FROM public.groups WHERE id = NEW.group_id;
  FOR r IN
    SELECT user_id FROM public.group_members WHERE group_id = NEW.group_id AND user_id <> NEW.user_id
  LOOP
    PERFORM public.emit_notification(r.user_id, NEW.user_id, 'group_member', NEW.group_id, gname, 'on_group_activity', NULL);
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS group_members_notify ON public.group_members;
CREATE TRIGGER group_members_notify AFTER INSERT ON public.group_members
  FOR EACH ROW EXECUTE FUNCTION public.notify_group_member();

-- realtime delivery for the bell
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
END $$;

ALTER TABLE public.notifications REPLICA IDENTITY FULL;