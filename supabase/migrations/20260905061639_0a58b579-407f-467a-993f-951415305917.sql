-- 1. Lock down SECURITY DEFINER helper functions: they are used inside RLS
-- policies (which run as the table owner) and triggers, never directly by clients.
REVOKE EXECUTE ON FUNCTION public.are_friends(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_see_story(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_see_message(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.in_thread(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.owns_thread(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.emit_notification(uuid, uuid, text, uuid, text, text, uuid) FROM anon, authenticated;

-- 2. ensure_birthday_reminders becomes parameterised and server-only.
DROP FUNCTION IF EXISTS public.ensure_birthday_reminders();
CREATE OR REPLACE FUNCTION public.ensure_birthday_reminders(_for_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  me uuid := _for_user;
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
      AND public.are_friends(p.user_id, me)
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
REVOKE EXECUTE ON FUNCTION public.ensure_birthday_reminders(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_birthday_reminders(uuid) TO service_role;

-- 3. Notifications: only server-side triggers may create them.
DROP POLICY IF EXISTS notifications_insert ON public.notifications;
REVOKE INSERT ON public.notifications FROM anon, authenticated;