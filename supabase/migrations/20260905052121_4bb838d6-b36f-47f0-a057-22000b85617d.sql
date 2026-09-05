REVOKE ALL ON FUNCTION public.notify_reaction() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_comment() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_friendship() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_message() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_group_post() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_group_member() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.emit_notification(uuid, uuid, text, uuid, text, text, uuid) FROM PUBLIC;