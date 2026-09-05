REVOKE ALL ON FUNCTION public.can_see_message(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_see_message(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_see_message(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.in_thread(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.owns_thread(uuid) FROM anon;