import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/lib/api";
import { ensureBirthdayRemindersFn } from "@/lib/notification.functions";

export type NotificationType =
  | "reaction"
  | "comment_reaction"
  | "comment"
  | "reply"
  | "friend_request"
  | "friend_accepted"
  | "mention"
  | "message"
  | "group_post"
  | "group_member"
  | "birthday"
  | "follow"
  | "share";

export type NotificationRecord = {
  id: string;
  type: string;
  target_id: string | null;
  body: string | null;
  read_at: string | null;
  created_at: string;
  actor: Pick<Profile, "id" | "display_name" | "avatar_url"> | null;
};

/** Several notifications about the same thing shown as one row. */
export type NotificationGroup = {
  key: string;
  ids: string[];
  type: string;
  target_id: string | null;
  body: string | null;
  created_at: string;
  unread: boolean;
  actors: Pick<Profile, "id" | "display_name" | "avatar_url">[];
  extraActors: number;
};

const SELECT =
  "id, type, target_id, body, read_at, created_at, actor:profiles!notifications_actor_id_fkey(id, display_name, avatar_url)";

export async function fetchNotificationRecords(userId: string, limit = 80) {
  const { data, error } = await supabase
    .from("notifications")
    .select(SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as NotificationRecord[];
}

const GROUPABLE = new Set(["reaction", "comment_reaction", "comment", "group_post", "group_member"]);

export function groupNotifications(rows: NotificationRecord[]): NotificationGroup[] {
  const groups: NotificationGroup[] = [];
  const index = new Map<string, NotificationGroup>();

  for (const row of rows) {
    const groupable = GROUPABLE.has(row.type) && row.target_id;
    const key = groupable ? `${row.type}:${row.target_id}` : `single:${row.id}`;
    const existing = index.get(key);

    if (existing) {
      existing.ids.push(row.id);
      existing.unread = existing.unread || !row.read_at;
      if (row.actor && !existing.actors.some((a) => a.id === row.actor!.id)) {
        if (existing.actors.length < 3) existing.actors.push(row.actor);
        else existing.extraActors += 1;
      }
      continue;
    }

    const group: NotificationGroup = {
      key,
      ids: [row.id],
      type: row.type,
      target_id: row.target_id,
      body: row.body,
      created_at: row.created_at,
      unread: !row.read_at,
      actors: row.actor ? [row.actor] : [],
      extraActors: 0,
    };
    index.set(key, group);
    groups.push(group);
  }

  return groups;
}

export async function unreadNotificationsCount(userId: string) {
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  return count ?? 0;
}

export async function markNotificationsRead(ids: string[], read: boolean) {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: read ? new Date().toISOString() : null })
    .in("id", ids);
  if (error) throw new Error(error.message);
}

export async function markAllRead(userId: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) throw new Error(error.message);
}

export async function removeNotifications(ids: string[]) {
  if (ids.length === 0) return;
  const { error } = await supabase.from("notifications").delete().in("id", ids);
  if (error) throw new Error(error.message);
}

/** Marks message notifications for an open conversation as read. */
export async function clearThreadNotifications(userId: string, threadId: string) {
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("type", "message")
    .eq("target_id", threadId)
    .is("read_at", null);
}

export async function muteNotificationSource(
  userId: string,
  kind: "post" | "actor",
  targetId: string,
) {
  const { error } = await supabase
    .from("notification_mutes")
    .upsert({ user_id: userId, kind, target_id: targetId }, { onConflict: "user_id,kind,target_id" });
  if (error) throw new Error(error.message);
}

export async function ensureBirthdayReminders() {
  await ensureBirthdayRemindersFn();
}

/* ---------- copy ---------- */

export function relativeTime(iso: string) {
  const then = new Date(iso).getTime();
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function snippet(body: string | null, max = 48) {
  if (!body) return "";
  const clean = body.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

export function notificationSentence(group: NotificationGroup) {
  const names = group.actors.map((a) => a.display_name);
  const others = group.actors.length - 1 + group.extraActors;
  const who =
    names.length === 0
      ? "Someone"
      : others > 0
        ? `${names[0]} and ${others} other${others > 1 ? "s" : ""}`
        : names[0]!;

  switch (group.type) {
    case "reaction":
      return `${who} reacted to your post`;
    case "comment_reaction":
      return `${who} reacted to your comment`;
    case "comment":
      return group.body
        ? `${who} commented on your post: “${snippet(group.body)}”`
        : `${who} commented on your post`;
    case "reply":
      return group.body
        ? `${who} replied to your comment: “${snippet(group.body)}”`
        : `${who} replied to your comment`;
    case "friend_request":
      return `${who} sent you a friend request`;
    case "friend_accepted":
      return `${who} accepted your friend request`;
    case "mention":
      return group.body ? `${who} mentioned you: “${snippet(group.body)}”` : `${who} mentioned you`;
    case "message":
      return group.body ? `${who} sent you a message: “${snippet(group.body)}”` : `${who} sent you a message`;
    case "group_post":
      return `${who} posted in a group you're in`;
    case "group_member":
      return group.body ? `${who} joined ${group.body}` : `${who} joined a group you're in`;
    case "birthday":
      return `${who} has a birthday today`;
    case "follow":
      return `${who} started following you`;
    case "share":
      return `${who} shared your post`;
    default:
      return `${who} ${group.type.replace(/_/g, " ")}`;
  }
}

export type NotificationBadge = "like" | "comment" | "friend" | "message" | "group" | "reminder";

export function notificationBadge(type: string): NotificationBadge {
  if (type === "reaction" || type === "comment_reaction") return "like";
  if (type === "comment" || type === "reply" || type === "mention" || type === "share") return "comment";
  if (type === "friend_request" || type === "friend_accepted" || type === "follow") return "friend";
  if (type === "message") return "message";
  if (type === "group_post" || type === "group_member") return "group";
  return "reminder";
}

/** Live notification stream: fires whenever a row for this user changes. */
export function useNotificationsRealtime(userId: string, onChange: (inserted: boolean) => void) {
  const handler = useRef(onChange);
  handler.current = onChange;

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => handler.current(payload.eventType === "INSERT"),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);
}

/** Plays a short bounce whenever the unread count grows. */
export function useBellBounce(count: number) {
  const [bouncing, setBouncing] = useState(false);
  const previous = useRef(count);

  useEffect(() => {
    if (count > previous.current) {
      setBouncing(true);
      const timer = window.setTimeout(() => setBouncing(false), 900);
      previous.current = count;
      return () => window.clearTimeout(timer);
    }
    previous.current = count;
    return undefined;
  }, [count]);

  return bouncing;
}
