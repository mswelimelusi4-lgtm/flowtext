REVOKE ALL ON FUNCTION public.notify_reaction() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_comment() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_friendship() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_message() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_group_post() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_group_member() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.emit_notification(uuid, uuid, text, uuid, text, text, uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.bump_thread() FROM anon, authenticated;