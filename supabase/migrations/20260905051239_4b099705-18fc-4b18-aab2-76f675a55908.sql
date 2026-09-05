ALTER TABLE public.threads ADD COLUMN IF NOT EXISTS photo_url text;

ALTER TABLE public.thread_participants
  ADD COLUMN IF NOT EXISTS state text NOT NULL DEFAULT 'accepted',
  ADD COLUMN IF NOT EXISTS muted_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS unread_flag boolean NOT NULL DEFAULT false;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'text';

CREATE TABLE IF NOT EXISTS public.message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_reactions TO authenticated;
GRANT ALL ON public.message_reactions TO service_role;

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_see_message(mid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.messages m
    JOIN public.thread_participants p ON p.thread_id = m.thread_id
    WHERE m.id = mid AND p.user_id = auth.uid()
  );
$$;

CREATE POLICY "participants read message reactions"
  ON public.message_reactions FOR SELECT TO authenticated
  USING (public.can_see_message(message_id));

CREATE POLICY "own message reactions insert"
  ON public.message_reactions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_see_message(message_id));

CREATE POLICY "own message reactions update"
  ON public.message_reactions FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "own message reactions delete"
  ON public.message_reactions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "senders can soft delete own messages" ON public.messages;
CREATE POLICY "senders can soft delete own messages"
  ON public.messages FOR UPDATE TO authenticated
  USING (sender_id = auth.uid()) WITH CHECK (sender_id = auth.uid());

CREATE INDEX IF NOT EXISTS message_reactions_message_idx ON public.message_reactions(message_id);
CREATE INDEX IF NOT EXISTS messages_thread_created_idx ON public.messages(thread_id, created_at);

ALTER PUBLICATION supabase_realtime ADD TABLE public.threads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.thread_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;