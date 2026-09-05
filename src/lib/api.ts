import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  location: string | null;
  work: string | null;
  education: string | null;
  created_at: string;
};

export type Post = {
  id: string;
  author_id: string;
  group_id: string | null;
  content: string;
  media_urls: string[];
  media_type: "image" | "video" | null;
  visibility: "public" | "friends" | "private";
  created_at: string;
  author: Profile | null;
};

export type Comment = {
  id: string;
  post_id: string;
  author_id: string;
  parent_comment_id: string | null;
  content: string;
  created_at: string;
  author: Profile | null;
};

export type ReactionType = "like" | "love" | "laugh" | "wow" | "sad";

export const REACTIONS: { type: ReactionType; label: string; glyph: string }[] = [
  { type: "like", label: "Like", glyph: "◒" },
  { type: "love", label: "Love", glyph: "♥" },
  { type: "laugh", label: "Laugh", glyph: "◠" },
  { type: "wow", label: "Wow", glyph: "◎" },
  { type: "sad", label: "Sad", glyph: "◡" },
];

const PROFILE_COLS = "id, display_name, bio, avatar_url, cover_url, location, work, education, created_at";
const POST_COLS = `id, author_id, group_id, content, media_urls, media_type, visibility, created_at, author:profiles!posts_author_id_fkey(${PROFILE_COLS})`;

export const PAGE_SIZE = 8;

function unwrap<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  return data as T;
}

export async function getProfile(id: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Profile | null;
}

export async function updateProfile(id: string, patch: Partial<Profile>) {
  const { error } = await supabase.from("profiles").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Feed: own posts + friends' + followed people's, newest first. */
export async function fetchFeed(userId: string, page: number, order: "recent" | "top") {
  const [{ data: friendRows }, { data: followRows }] = await Promise.all([
    supabase
      .from("friendships")
      .select("requester_id, addressee_id")
      .eq("status", "accepted")
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`),
    supabase.from("follows").select("target_id").eq("follower_id", userId),
  ]);

  const ids = new Set<string>([userId]);
  (friendRows ?? []).forEach((r) => {
    ids.add(r.requester_id === userId ? r.addressee_id : r.requester_id);
  });
  (followRows ?? []).forEach((r) => ids.add(r.target_id));

  const from = page * PAGE_SIZE;
  const { data, error } = await supabase
    .from("posts")
    .select(POST_COLS)
    .is("group_id", null)
    .in("author_id", Array.from(ids))
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  const rows = unwrap(data, error) as unknown as Post[];
  if (order === "top") {
    const counts = await reactionCounts(rows.map((p) => p.id));
    return [...rows].sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0));
  }
  return rows;
}

async function reactionCounts(postIds: string[]) {
  if (postIds.length === 0) return {} as Record<string, number>;
  const { data } = await supabase.from("reactions").select("post_id").in("post_id", postIds);
  const out: Record<string, number> = {};
  (data ?? []).forEach((r) => {
    if (r.post_id) out[r.post_id] = (out[r.post_id] ?? 0) + 1;
  });
  return out;
}

export async function fetchGroupFeed(groupId: string, page: number) {
  const from = page * PAGE_SIZE;
  const { data, error } = await supabase
    .from("posts")
    .select(POST_COLS)
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  return unwrap(data, error) as unknown as Post[];
}

export async function fetchUserPosts(authorId: string) {
  const { data, error } = await supabase
    .from("posts")
    .select(POST_COLS)
    .eq("author_id", authorId)
    .is("group_id", null)
    .order("created_at", { ascending: false })
    .limit(30);
  return unwrap(data, error) as unknown as Post[];
}

export async function createPost(input: {
  authorId: string;
  content: string;
  mediaUrls: string[];
  mediaType: "image" | "video" | null;
  visibility: "public" | "friends" | "private";
  groupId?: string | null;
}) {
  const { error } = await supabase.from("posts").insert({
    author_id: input.authorId,
    content: input.content,
    media_urls: input.mediaUrls,
    media_type: input.mediaType,
    visibility: input.visibility,
    group_id: input.groupId ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function deletePost(id: string) {
  const { error } = await supabase.from("posts").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export type PostReactionState = {
  counts: Partial<Record<ReactionType, number>>;
  mine: ReactionType | null;
  commentCount: number;
};

export async function fetchPostMeta(postId: string, userId: string): Promise<PostReactionState> {
  const [{ data: reactions }, { count }] = await Promise.all([
    supabase.from("reactions").select("type, user_id").eq("post_id", postId),
    supabase.from("comments").select("id", { count: "exact", head: true }).eq("post_id", postId),
  ]);
  const counts: Partial<Record<ReactionType, number>> = {};
  let mine: ReactionType | null = null;
  (reactions ?? []).forEach((r) => {
    const t = r.type as ReactionType;
    counts[t] = (counts[t] ?? 0) + 1;
    if (r.user_id === userId) mine = t;
  });
  return { counts, mine, commentCount: count ?? 0 };
}

export async function setReaction(opts: {
  userId: string;
  type: ReactionType;
  postId?: string;
  commentId?: string;
  current: ReactionType | null;
}) {
  const target = opts.postId ? { post_id: opts.postId } : { comment_id: opts.commentId! };
  const match = opts.postId
    ? { user_id: opts.userId, post_id: opts.postId }
    : { user_id: opts.userId, comment_id: opts.commentId! };

  if (opts.current === opts.type) {
    const { error } = await supabase.from("reactions").delete().match(match);
    if (error) throw new Error(error.message);
    return;
  }
  if (opts.current) {
    const { error } = await supabase.from("reactions").update({ type: opts.type }).match(match);
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await supabase
    .from("reactions")
    .insert({ user_id: opts.userId, type: opts.type, ...target });
  if (error) throw new Error(error.message);
}

export async function fetchComments(postId: string) {
  const { data, error } = await supabase
    .from("comments")
    .select(`id, post_id, author_id, parent_comment_id, content, created_at, author:profiles!comments_author_id_fkey(${PROFILE_COLS})`)
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  return unwrap(data, error) as unknown as Comment[];
}

export async function addComment(input: {
  postId: string;
  authorId: string;
  content: string;
  parentCommentId?: string | null;
}) {
  const { error } = await supabase.from("comments").insert({
    post_id: input.postId,
    author_id: input.authorId,
    content: input.content,
    parent_comment_id: input.parentCommentId ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function notify(input: {
  userId: string;
  actorId: string;
  type: string;
  targetId?: string | null;
  body?: string | null;
}) {
  if (input.userId === input.actorId) return;
  await supabase.from("notifications").insert({
    user_id: input.userId,
    actor_id: input.actorId,
    type: input.type,
    target_id: input.targetId ?? null,
    body: input.body ?? null,
  });
}

/* ---------- social graph ---------- */

export type FriendEdge = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted";
  created_at: string;
};

export async function fetchFriendEdges(userId: string) {
  const { data, error } = await supabase
    .from("friendships")
    .select("id, requester_id, addressee_id, status, created_at")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
  return unwrap(data, error) as FriendEdge[];
}

export async function friendIdsOf(userId: string) {
  const { data } = await supabase
    .from("friendships")
    .select("requester_id, addressee_id")
    .eq("status", "accepted")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
  return (data ?? []).map((r) => (r.requester_id === userId ? r.addressee_id : r.requester_id));
}

export async function sendFriendRequest(requesterId: string, addresseeId: string) {
  const { error } = await supabase
    .from("friendships")
    .insert({ requester_id: requesterId, addressee_id: addresseeId });
  if (error) throw new Error(error.message);
  await notify({ userId: addresseeId, actorId: requesterId, type: "friend_request" });
}

export async function acceptFriendRequest(edgeId: string, requesterId: string, myId: string) {
  const { error } = await supabase
    .from("friendships")
    .update({ status: "accepted" })
    .eq("id", edgeId);
  if (error) throw new Error(error.message);
  await notify({ userId: requesterId, actorId: myId, type: "friend_accepted" });
}

export async function removeFriendEdge(edgeId: string) {
  const { error } = await supabase.from("friendships").delete().eq("id", edgeId);
  if (error) throw new Error(error.message);
}

export async function fetchFollowing(userId: string) {
  const { data } = await supabase.from("follows").select("target_id").eq("follower_id", userId);
  return (data ?? []).map((r) => r.target_id);
}

export async function toggleFollow(followerId: string, targetId: string, following: boolean) {
  if (following) {
    const { error } = await supabase
      .from("follows")
      .delete()
      .match({ follower_id: followerId, target_id: targetId });
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await supabase
    .from("follows")
    .insert({ follower_id: followerId, target_id: targetId });
  if (error) throw new Error(error.message);
  await notify({ userId: targetId, actorId: followerId, type: "follow" });
}

/** People you may know: friends-of-friends, ranked by mutual count. */
export async function fetchSuggestions(userId: string) {
  const myFriends = await friendIdsOf(userId);
  const edges = await fetchFriendEdges(userId);
  const excluded = new Set<string>([userId, ...edges.flatMap((e) => [e.requester_id, e.addressee_id])]);

  const mutuals = new Map<string, number>();
  if (myFriends.length > 0) {
    const { data } = await supabase
      .from("friendships")
      .select("requester_id, addressee_id")
      .eq("status", "accepted")
      .or(
        `requester_id.in.(${myFriends.join(",")}),addressee_id.in.(${myFriends.join(",")})`,
      );
    (data ?? []).forEach((r) => {
      [r.requester_id, r.addressee_id].forEach((cand) => {
        if (excluded.has(cand) || myFriends.includes(cand)) return;
        mutuals.set(cand, (mutuals.get(cand) ?? 0) + 1);
      });
    });
  }

  let ids = Array.from(mutuals.keys());
  if (ids.length < 5) {
    const { data } = await supabase.from("profiles").select("id").limit(30);
    (data ?? []).forEach((p) => {
      if (!excluded.has(p.id) && !ids.includes(p.id)) ids.push(p.id);
    });
  }
  ids = ids.slice(0, 12);
  if (ids.length === 0) return [] as { profile: Profile; mutual: number }[];

  const { data: profiles } = await supabase.from("profiles").select(PROFILE_COLS).in("id", ids);
  return ((profiles ?? []) as unknown as Profile[])
    .map((profile) => ({ profile, mutual: mutuals.get(profile.id) ?? 0 }))
    .sort((a, b) => b.mutual - a.mutual)
    .slice(0, 6);
}

export async function mutualCount(userId: string, otherId: string) {
  const [mine, theirs] = await Promise.all([friendIdsOf(userId), friendIdsOf(otherId)]);
  const set = new Set(theirs);
  return mine.filter((id) => set.has(id)).length;
}

/* ---------- groups & pages ---------- */

export type Group = {
  id: string;
  name: string;
  description: string | null;
  privacy: "public" | "private";
  cover_url: string | null;
  created_by: string;
  created_at: string;
};

export async function fetchGroups() {
  const { data, error } = await supabase
    .from("groups")
    .select("id, name, description, privacy, cover_url, created_by, created_at")
    .order("created_at", { ascending: false });
  return unwrap(data, error) as Group[];
}

export async function fetchGroup(id: string) {
  const { data, error } = await supabase
    .from("groups")
    .select("id, name, description, privacy, cover_url, created_by, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Group | null;
}

export async function fetchGroupMemberships(userId: string) {
  const { data } = await supabase.from("group_members").select("group_id, role").eq("user_id", userId);
  return data ?? [];
}

export async function fetchGroupMembers(groupId: string) {
  const { data, error } = await supabase
    .from("group_members")
    .select(`role, user:profiles!group_members_user_id_fkey(${PROFILE_COLS})`)
    .eq("group_id", groupId);
  return unwrap(data, error) as unknown as { role: string; user: Profile }[];
}

export async function createGroup(input: {
  name: string;
  description: string;
  privacy: "public" | "private";
  createdBy: string;
}) {
  const { data, error } = await supabase
    .from("groups")
    .insert({
      name: input.name,
      description: input.description,
      privacy: input.privacy,
      created_by: input.createdBy,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await supabase.from("group_members").insert({
    group_id: data.id,
    user_id: input.createdBy,
    role: "owner",
  });
  return data.id as string;
}

export async function joinGroup(groupId: string, userId: string) {
  const { error } = await supabase.from("group_members").insert({ group_id: groupId, user_id: userId });
  if (error) throw new Error(error.message);
}

export async function leaveGroup(groupId: string, userId: string) {
  const { error } = await supabase
    .from("group_members")
    .delete()
    .match({ group_id: groupId, user_id: userId });
  if (error) throw new Error(error.message);
}

export type Page = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  avatar_url: string | null;
  created_by: string;
};

export async function fetchPages() {
  const { data, error } = await supabase
    .from("pages")
    .select("id, name, description, category, avatar_url, created_by")
    .order("created_at", { ascending: false });
  return unwrap(data, error) as Page[];
}

export async function fetchPageFollows(userId: string) {
  const { data } = await supabase.from("page_follows").select("page_id").eq("user_id", userId);
  return (data ?? []).map((r) => r.page_id);
}

export async function togglePageFollow(pageId: string, userId: string, following: boolean) {
  if (following) {
    const { error } = await supabase
      .from("page_follows")
      .delete()
      .match({ page_id: pageId, user_id: userId });
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await supabase.from("page_follows").insert({ page_id: pageId, user_id: userId });
  if (error) throw new Error(error.message);
}

export async function createPage(input: {
  name: string;
  description: string;
  category: string;
  createdBy: string;
}) {
  const { data, error } = await supabase
    .from("pages")
    .insert({
      name: input.name,
      description: input.description,
      category: input.category,
      created_by: input.createdBy,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await supabase.from("page_follows").insert({ page_id: data.id, user_id: input.createdBy });
  return data.id as string;
}

/* ---------- messaging ---------- */

export type ThreadSummary = {
  id: string;
  title: string | null;
  is_group: boolean;
  last_message_at: string;
  participants: Profile[];
  lastMessage: string | null;
  unread: number;
};

export async function fetchThreads(userId: string): Promise<ThreadSummary[]> {
  const { data: mine } = await supabase
    .from("thread_participants")
    .select("thread_id, last_read_at")
    .eq("user_id", userId);
  const threadIds = (mine ?? []).map((r) => r.thread_id);
  if (threadIds.length === 0) return [];

  const [{ data: threads }, { data: participants }, { data: messages }] = await Promise.all([
    supabase
      .from("threads")
      .select("id, title, is_group, last_message_at")
      .in("id", threadIds)
      .order("last_message_at", { ascending: false }),
    supabase
      .from("thread_participants")
      .select(`thread_id, user:profiles!thread_participants_user_id_fkey(${PROFILE_COLS})`)
      .in("thread_id", threadIds),
    supabase
      .from("messages")
      .select("thread_id, content, created_at, sender_id")
      .in("thread_id", threadIds)
      .order("created_at", { ascending: false }),
  ]);

  const readMap = new Map((mine ?? []).map((r) => [r.thread_id, r.last_read_at]));

  return (threads ?? []).map((t) => {
    const people = ((participants ?? []) as unknown as { thread_id: string; user: Profile }[])
      .filter((p) => p.thread_id === t.id)
      .map((p) => p.user)
      .filter((p) => p.id !== userId);
    const threadMessages = (messages ?? []).filter((m) => m.thread_id === t.id);
    const lastRead = readMap.get(t.id) ?? new Date(0).toISOString();
    return {
      id: t.id,
      title: t.title,
      is_group: t.is_group,
      last_message_at: t.last_message_at,
      participants: people,
      lastMessage: threadMessages[0]?.content ?? null,
      unread: threadMessages.filter((m) => m.sender_id !== userId && m.created_at > lastRead).length,
    };
  });
}

export async function fetchMessages(threadId: string) {
  const { data, error } = await supabase
    .from("messages")
    .select(`id, thread_id, sender_id, content, media_url, created_at, sender:profiles!messages_sender_id_fkey(${PROFILE_COLS})`)
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  return unwrap(data, error) as unknown as {
    id: string;
    sender_id: string;
    content: string;
    media_url: string | null;
    created_at: string;
    sender: Profile | null;
  }[];
}

export async function sendMessage(input: {
  threadId: string;
  senderId: string;
  content: string;
  mediaUrl?: string | null;
}) {
  const { error } = await supabase.from("messages").insert({
    thread_id: input.threadId,
    sender_id: input.senderId,
    content: input.content,
    media_url: input.mediaUrl ?? null,
  });
  if (error) throw new Error(error.message);

  const { data: others } = await supabase
    .from("thread_participants")
    .select("user_id")
    .eq("thread_id", input.threadId);
  await Promise.all(
    (others ?? [])
      .filter((p) => p.user_id !== input.senderId)
      .map((p) =>
        notify({
          userId: p.user_id,
          actorId: input.senderId,
          type: "message",
          targetId: input.threadId,
          body: input.content.slice(0, 90),
        }),
      ),
  );
}

export async function markThreadRead(threadId: string, userId: string) {
  await supabase
    .from("thread_participants")
    .update({ last_read_at: new Date().toISOString() })
    .match({ thread_id: threadId, user_id: userId });
}

/** Finds an existing 1:1 thread or creates one. */
export async function openDirectThread(myId: string, otherId: string) {
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
      if (direct && direct.length > 0) return direct[0].id as string;
    }
  }
  const { data: thread, error } = await supabase
    .from("threads")
    .insert({ created_by: myId, is_group: false })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const { error: partError } = await supabase.from("thread_participants").insert([
    { thread_id: thread.id, user_id: myId },
    { thread_id: thread.id, user_id: otherId },
  ]);
  if (partError) throw new Error(partError.message);
  return thread.id as string;
}

export async function createGroupThread(myId: string, memberIds: string[], title: string) {
  const { data: thread, error } = await supabase
    .from("threads")
    .insert({ created_by: myId, is_group: true, title })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const rows = [myId, ...memberIds].map((id) => ({ thread_id: thread.id, user_id: id }));
  const { error: partError } = await supabase.from("thread_participants").insert(rows);
  if (partError) throw new Error(partError.message);
  return thread.id as string;
}

/* ---------- notifications ---------- */

export type NotificationRow = {
  id: string;
  type: string;
  target_id: string | null;
  body: string | null;
  read_at: string | null;
  created_at: string;
  actor: Profile | null;
};

export async function fetchNotifications(userId: string) {
  const { data, error } = await supabase
    .from("notifications")
    .select(`id, type, target_id, body, read_at, created_at, actor:profiles!notifications_actor_id_fkey(${PROFILE_COLS})`)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(60);
  return unwrap(data, error) as unknown as NotificationRow[];
}

export async function markAllNotificationsRead(userId: string) {
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);
}

export async function unreadNotificationCount(userId: string) {
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  return count ?? 0;
}

/* ---------- search ---------- */

export async function globalSearch(term: string) {
  const like = `%${term}%`;
  const [people, posts, groups, pages] = await Promise.all([
    supabase.from("profiles").select(PROFILE_COLS).ilike("display_name", like).limit(10),
    supabase.from("posts").select(POST_COLS).ilike("content", like).limit(10),
    supabase
      .from("groups")
      .select("id, name, description, privacy, cover_url, created_by, created_at")
      .ilike("name", like)
      .limit(10),
    supabase
      .from("pages")
      .select("id, name, description, category, avatar_url, created_by")
      .ilike("name", like)
      .limit(10),
  ]);
  return {
    people: (people.data ?? []) as unknown as Profile[],
    posts: (posts.data ?? []) as unknown as Post[],
    groups: (groups.data ?? []) as Group[],
    pages: (pages.data ?? []) as Page[],
  };
}
