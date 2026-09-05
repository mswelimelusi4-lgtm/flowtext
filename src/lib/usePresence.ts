import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type PresenceMeta = { userId: string; at: number };

/** Tracks who is online across FlowText via a shared presence channel. */
export function usePresence(userId: string) {
  const [online, setOnline] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!userId) return;
    const channel = supabase.channel("flowtext-presence", {
      config: { presence: { key: userId } },
    });
    const sync = () => {
      const state = channel.presenceState<PresenceMeta>();
      const next: Record<string, number> = {};
      Object.entries(state).forEach(([key, metas]) => {
        next[key] = metas[0]?.at ?? Date.now();
      });
      setOnline(next);
    };
    channel
      .on("presence", { event: "sync" }, sync)
      .on("presence", { event: "join" }, sync)
      .on("presence", { event: "leave" }, sync)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void channel.track({ userId, at: Date.now() });
      });
    const beat = window.setInterval(() => {
      void channel.track({ userId, at: Date.now() });
    }, 30000);
    return () => {
      window.clearInterval(beat);
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  return useMemo(
    () => ({
      isOnline: (id: string) => Boolean(online[id]),
      lastSeen: (id: string) => online[id] ?? null,
    }),
    [online],
  );
}

/** Per-conversation channel: live messages + typing indicators. */
export function useThreadChannel(
  threadId: string | undefined,
  userId: string,
  onChange: () => void,
) {
  const [typingIds, setTypingIds] = useState<string[]>([]);
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timers = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!threadId) return;
    const channel = supabase.channel(`thread-${threadId}`, {
      config: { broadcast: { self: false } },
    });
    channelRef.current = channel;
    channel
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `thread_id=eq.${threadId}` }, () =>
        changeRef.current(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, () =>
        changeRef.current(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "thread_participants", filter: `thread_id=eq.${threadId}` }, () =>
        changeRef.current(),
      )
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const id = (payload as { userId?: string }).userId;
        if (!id || id === userId) return;
        setTypingIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
        window.clearTimeout(timers.current[id]);
        timers.current[id] = window.setTimeout(() => {
          setTypingIds((prev) => prev.filter((x) => x !== id));
        }, 3000);
      })
      .subscribe();

    return () => {
      Object.values(timers.current).forEach((t) => window.clearTimeout(t));
      timers.current = {};
      setTypingIds([]);
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [threadId, userId]);

  const lastPing = useRef(0);
  const sendTyping = () => {
    const now = Date.now();
    if (now - lastPing.current < 1200) return;
    lastPing.current = now;
    void channelRef.current?.send({ type: "broadcast", event: "typing", payload: { userId } });
  };

  return { typingIds, sendTyping };
}

/** Inbox-level realtime: any new message or participant change refreshes the list. */
export function useInboxRealtime(userId: string, onChange: () => void) {
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`inbox-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => changeRef.current())
      .on("postgres_changes", { event: "*", schema: "public", table: "thread_participants" }, () =>
        changeRef.current(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "threads" }, () => changeRef.current())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);
}
