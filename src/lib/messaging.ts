import { supabase } from "@/integrations/supabase/client";
import { friendIdsOf, type Profile } from "@/lib/api";

const PROFILE_LITE = "id, display_name, avatar_url";

export type ProfileLite = { id: string; display_name: string; avatar_url: string | null };

export type ThreadState = "accepted" | "pending";

export type InboxThread = {
  id: string;
  title: string | null;
  photo_url: string | null;
  is_group: boolean;
  last_message_at: string;
  participants: ProfileLite[];
  members: ProfileLite[];
  lastMessage: { content: string; sender_id: string; kind: string; deleted: boolean } | null;
  unread: number;
  state: ThreadState;
  muted: boolean;
  archived: boolean;
};

export type ChatMessage = {
  id: string;
  thread_id: string;
  sender_id: string;
  content: string;
  media_url: string | null;
  kind: string;
  reply_to_id: string | null;
  deleted_at: string | null;
  created_at: string;
  sender: ProfileLite | null;
  replyTo: { id: string; content: string; sender_id: string; deleted_at: string | null } | null;
  reactions: { user_id: string; emoji: string }[];
};

export const MESSAGE_EMOJI = ["👍", "❤️", "😂", "😮", "😢", "😡"];

export function shortTime(iso: string) {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const min = Math.round(diff / 60000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return new Date(iso).toLocaleDateString(undefined, { weekday: "short" });
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function activeLabel(lastSeen: number | null, online: boolean) {
  if (online) return "Active now";
  if (!lastSeen) return "Offline";
  const min = Math.max(1, Math.round((Date.now() - lastSeen) / 60000));
  if (min < 60) return `Active ${min}m ago`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `Active ${hours}h ago`;
  return "Offline";
}

export function threadTitle(thread: InboxThread, myId: string) {
  if (thread.title) return thread.title;
  const others = thread.participants.filter((p) => p.id !== myId);
  if (others.length === 0) return "You";
  return others.map((p) => p.display_name).join(", ");
}

/* ---------- inbox ---------- */

export async function fetchInbox(userId: string): Promise<InboxThread[]> {
  const { data: mine, error } = await supabase
    .from("thread_participants")
    .select("thread_id, last_read_at, state, muted_at, archived_at, unread_flag")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const rows = mine ?? [];
  if (rows.length === 0) return [];
  const threadIds = rows.map((r) => r.thread_id);

  const [{ data: threads }, { data: participants }, { data: messages }] = await Promise.all([
    supabase
      .from("threads")
      .select("id, title, is_group, photo_url, last_message_at")
      .in("id", threadIds)
      .order("last_message_at", { ascending: false }),
    supabase
      .from("thread_participants")
      .select(`thread_id, user:profiles!thread_participants_user_id_fkey(${PROFILE_LITE})`)
      .in("thread_id", threadIds),
    supabase
      .from("messages")
      .select("thread_id, content, created_at, sender_id, kind, deleted_at")
      .in("thread_id", threadIds)
      .order("created_at", { ascending: false }),
  ]);

  const peopleRows = (participants ?? []) as unknown as { thread_id: string; user: ProfileLite }[];

  return (threads ?? []).map((t) => {
    const mineRow = rows.find((r) => r.thread_id === t.id);
    const members = peopleRows.filter((p) => p.thread_id === t.id).map((p) => p.user);
    const threadMessages = (messages ?? []).filter((m) => m.thread_id === t.id);
    const lastRead = mineRow?.last_read_at ?? new Date(0).toISOString();
    const last = threadMessages[0];
    const unreadCount = threadMessages.filter(
      (m) => m.sender_id !== userId && m.created_at > lastRead,
    ).length;
    return {
      id: t.id,
      title: t.title,
      photo_url: t.photo_url,
      is_group: t.is_group,
      last_message_at: t.last_message_at,
      members,
      participants: members.filter((p) => p.id !== userId),
      lastMessage: last
        ? {
            content: last.content,
            sender_id: last.sender_id,
            kind: last.kind,
            deleted: Boolean(last.deleted_at),
          }
        : null,
      unread: mineRow?.unread_flag && unreadCount === 0 ? 1 : unreadCount,
      state: (mineRow?.state === "pending" ? "pending" : "accepted") as ThreadState,
      muted: Boolean(mineRow?.muted_at),
      archived: Boolean(mineRow?.archived_at),
    };
  });
}

export async function markThreadRead(threadId: string, userId: string) {
  await supabase
    .from("thread_participants")
    .update({ last_read_at: new Date().toISOString(), unread_flag: false })
    .match({ thread_id: threadId, user_id: userId });
}

export async function markThreadUnread(threadId: string, userId: string) {
  await supabase
    .from("thread_participants")
    .update({ unread_flag: true })
    .match({ thread_id: threadId, user_id: userId });
}

export async function setThreadMuted(threadId: string, userId: string, muted: boolean) {
  await supabase
    .from("thread_participants")
    .update({ muted_at: muted ? new Date().toISOString() : null })
    .match({ thread_id: threadId, user_id: userId });
}

export async function setThreadArchived(threadId: string, userId: string, archived: boolean) {
  await supabase
    .from("thread_participants")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .match({ thread_id: threadId, user_id: userId });
}

/** Leaves/hides the conversation for me only. */
export async function deleteThreadForMe(threadId: string, userId: string) {
  const { error } = await supabase
    .from("thread_participants")
    .delete()
    .match({ thread_id: threadId, user_id: userId });
  if (error) throw new Error(error.message);
}

export async function acceptRequest(threadId: string, userId: string) {
  const { error } = await supabase
    .from("thread_participants")
    .update({ state: "accepted" })
    .match({ thread_id: threadId, user_id: userId });
  if (error) throw new Error(error.message);
}

/* ---------- conversation ---------- */

export async function fetchChatMessages(threadId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("messages")
    .select(
      `id, thread_id, sender_id, content, media_url, kind, reply_to_id, deleted_at, created_at,
       sender:profiles!messages_sender_id_fkey(${PROFILE_LITE})`,
    )
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as Omit<ChatMessage, "replyTo" | "reactions">[];
  const ids = rows.map((r) => r.id);
  const { data: reactions } = ids.length
    ? await supabase.from("message_reactions").select("message_id, user_id, emoji").in("message_id", ids)
    : { data: [] };
  const byId = new Map(rows.map((r) => [r.id, r]));
  return rows.map((row) => {
    const parent = row.reply_to_id ? byId.get(row.reply_to_id) : undefined;
    return {
      ...row,
      replyTo: parent
        ? {
            id: parent.id,
            content: parent.content,
            sender_id: parent.sender_id,
            deleted_at: parent.deleted_at,
          }
        : null,
      reactions: (reactions ?? [])
        .filter((r) => r.message_id === row.id)
        .map((r) => ({ user_id: r.user_id, emoji: r.emoji })),
    };
  });
}

export async function sendChatMessage(input: {
  threadId: string;
  senderId: string;
  content: string;
  mediaUrl?: string | null;
  replyToId?: string | null;
  kind?: string;
}) {
  const { error } = await supabase.from("messages").insert({
    thread_id: input.threadId,
    sender_id: input.senderId,
    content: input.content,
    media_url: input.mediaUrl ?? null,
    reply_to_id: input.replyToId ?? null,
    kind: input.kind ?? "text",
  });
  if (error) throw new Error(error.message);
}

export async function unsendMessage(messageId: string) {
  const { error } = await supabase
    .from("messages")
    .update({ deleted_at: new Date().toISOString(), content: "", media_url: null })
    .eq("id", messageId);
  if (error) throw new Error(error.message);
}

export async function reactToMessage(messageId: string, userId: string, emoji: string) {
  const { data: existing } = await supabase
    .from("message_reactions")
    .select("id, emoji")
    .match({ message_id: messageId, user_id: userId })
    .maybeSingle();
  if (existing) {
    if (existing.emoji === emoji) {
      await supabase.from("message_reactions").delete().eq("id", existing.id);
      return;
    }
    await supabase.from("message_reactions").update({ emoji }).eq("id", existing.id);
    return;
  }
  const { error } = await supabase
    .from("message_reactions")
    .insert({ message_id: messageId, user_id: userId, emoji });
  if (error) throw new Error(error.message);
}

/* ---------- threads / groups ---------- */

/** Opens (or creates) a 1:1 thread; non-friends land in the recipient's Requests tab. */
export async function openDirectChat(myId: string, otherId: string) {
  const { data: mine } = await supabase
    .from("thread_participants")
    .select("thread_id")
    .eq("user_id", myId);
  const ids = (mine ?? []).map((r) => r.thread_id);
  if (ids.length > 0) {
    const { data: shared } = await supabase
      .from("thread_participants")
      .select("thread_id")
      .eq("user_id", otherId)
      .in("thread_id", ids);
    const candidates = (shared ?? []).map((r) => r.thread_id);
    if (candidates.length > 0) {
      const { data: direct } = await supabase
        .from("threads")
        .select("id")
        .in("id", candidates)
        .eq("is_group", false)
        .limit(1);
      const found = direct?.[0];
      if (found) return found.id as string;
    }
  }
  const friends = await friendIdsOf(myId);
  const isFriend = friends.includes(otherId);
  const { data: thread, error } = await supabase
    .from("threads")
    .insert({ created_by: myId, is_group: false })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const { error: partError } = await supabase.from("thread_participants").insert([
    { thread_id: thread.id, user_id: myId, state: "accepted" },
    { thread_id: thread.id, user_id: otherId, state: isFriend ? "accepted" : "pending" },
  ]);
  if (partError) throw new Error(partError.message);
  return thread.id as string;
}

export async function updateThreadInfo(
  threadId: string,
  patch: { title?: string | null; photo_url?: string | null },
) {
  const { error } = await supabase.from("threads").update(patch).eq("id", threadId);
  if (error) throw new Error(error.message);
}

export async function addThreadMembers(threadId: string, userIds: string[]) {
  if (userIds.length === 0) return;
  const { error } = await supabase.from("thread_participants").insert(
    userIds.map((id) => ({ thread_id: threadId, user_id: id, state: "accepted" })),
  );
  if (error) throw new Error(error.message);
}

export async function removeThreadMember(threadId: string, userId: string) {
  const { error } = await supabase
    .from("thread_participants")
    .delete()
    .match({ thread_id: threadId, user_id: userId });
  if (error) throw new Error(error.message);
}

export async function friendProfiles(userId: string): Promise<Profile[]> {
  const ids = await friendIdsOf(userId);
  if (ids.length === 0) return [];
  const { data } = await supabase.from("profiles").select("*").in("id", ids);
  return (data ?? []) as unknown as Profile[];
}

export type ParticipantRead = {
  user_id: string;
  last_read_at: string;
  state: string;
};

export async function fetchParticipantReads(threadId: string): Promise<ParticipantRead[]> {
  const { data } = await supabase
    .from("thread_participants")
    .select("user_id, last_read_at, state")
    .eq("thread_id", threadId);
  return (data ?? []) as ParticipantRead[];
}
