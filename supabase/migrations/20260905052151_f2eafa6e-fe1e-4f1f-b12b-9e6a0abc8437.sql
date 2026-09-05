-- mentions in posts and comments
CREATE OR REPLACE FUNCTION public.notify_mentions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  handle text;
  target uuid;
  actor uuid;
  pid uuid;
BEGIN
  IF TG_TABLE_NAME = 'posts' THEN
    actor := NEW.author_id; pid := NEW.id;
  ELSE
    actor := NEW.author_id; pid := NEW.post_id;
  END IF;

  FOR handle IN
    SELECT DISTINCT lower(m[1]) FROM regexp_matches(coalesce(NEW.content, ''), '@([A-Za-z0-9_\.]{2,40})', 'g') AS m
  LOOP
    SELECT id INTO target FROM public.profiles
      WHERE lower(replace(display_name, ' ', '')) = handle
      LIMIT 1;
    IF target IS NOT NULL THEN
      PERFORM public.emit_notification(target, actor, 'mention', pid, left(coalesce(NEW.content, ''), 120), NULL, pid);
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_mentions() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS posts_notify_mentions ON public.posts;
CREATE TRIGGER posts_notify_mentions AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.notify_mentions();

DROP TRIGGER IF EXISTS comments_notify_mentions ON public.comments;
CREATE TRIGGER comments_notify_mentions AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_mentions();

-- birthday reminders for the calling user's friends, idempotent per day
CREATE OR REPLACE FUNCTION public.ensure_birthday_reminders()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := auth.uid();
  r record;
BEGIN
  IF me IS NULL THEN RETURN; END IF;
  IF NOT coalesce((SELECT on_reminder FROM public.notification_prefs WHERE user_id = me), true) THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT p.user_id AS friend_id
    FROM public.profile_private p
    WHERE p.birthday IS NOT NULL
      AND extract(month from p.birthday) = extract(month from current_date)
      AND extract(day from p.birthday) = extract(day from current_date)
      AND p.user_id <> me
      AND EXISTS (
        SELECT 1 FROM public.friendships f
        WHERE f.status = 'accepted'
          AND ((f.requester_id = me AND f.addressee_id = p.user_id)
            OR (f.addressee_id = me AND f.requester_id = p.user_id))
      )
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = me AND n.type = 'birthday' AND n.actor_id = r.friend_id
        AND n.created_at > current_date - interval '1 day'
    ) THEN
      INSERT INTO public.notifications (user_id, actor_id, type, target_id, body)
      VALUES (me, r.friend_id, 'birthday', r.friend_id, 'has a birthday today');
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_birthday_reminders() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_birthday_reminders() TO authenticated;