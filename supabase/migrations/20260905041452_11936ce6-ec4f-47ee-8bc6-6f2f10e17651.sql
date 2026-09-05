DROP POLICY "threads_select" ON public.threads;
DROP POLICY "threads_update" ON public.threads;
DROP POLICY "tp_select" ON public.thread_participants;
DROP POLICY "tp_insert" ON public.thread_participants;
DROP POLICY "messages_select" ON public.messages;
DROP POLICY "messages_insert" ON public.messages;

DROP FUNCTION IF EXISTS public.is_thread_participant(UUID, UUID);
DROP FUNCTION IF EXISTS public.is_thread_creator(UUID, UUID);

CREATE OR REPLACE FUNCTION public.in_thread(tid UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.thread_participants p WHERE p.thread_id = tid AND p.user_id = auth.uid());
$$;
CREATE OR REPLACE FUNCTION public.owns_thread(tid UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.threads t WHERE t.id = tid AND t.created_by = auth.uid());
$$;
REVOKE ALL ON FUNCTION public.in_thread(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owns_thread(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.in_thread(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owns_thread(UUID) TO authenticated;

CREATE POLICY "threads_select" ON public.threads FOR SELECT TO authenticated USING (public.in_thread(id));
CREATE POLICY "threads_update" ON public.threads FOR UPDATE TO authenticated USING (public.in_thread(id)) WITH CHECK (public.in_thread(id));
CREATE POLICY "tp_select" ON public.thread_participants FOR SELECT TO authenticated USING (public.in_thread(thread_id));
CREATE POLICY "tp_insert" ON public.thread_participants FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR public.owns_thread(thread_id));
CREATE POLICY "messages_select" ON public.messages FOR SELECT TO authenticated USING (public.in_thread(thread_id));
CREATE POLICY "messages_insert" ON public.messages FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid() AND public.in_thread(thread_id));