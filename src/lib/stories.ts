import { supabase } from "@/integrations/supabase/client";
import { friendIdsOf, type Profile } from "@/lib/api";

export type StoryKind = "photo" | "video" | "text";
export type StoryVisibility = "public" | "friends";

export type StoryOverlay = {
  id: string;
  kind: "text" | "sticker";
  value: string;
  x: number;
  y: number;
  color?: string;
  size?: number;
};

export type Story = {
  id: string;
  author_id: string;
  kind: StoryKind;
  media_url: string | null;
  caption: string | null;
  background: string;
  text_color: string;
  overlays: StoryOverlay[];
  drawing: string | null;
  duration_ms: number;
  visibility: StoryVisibility;
  created_at: string;
  expires_at: string;
  author?: Pick<Profile, "id" | "display_name" | "avatar_url"> | null;
};

export type StoryGroup = {
  author: Pick<Profile, "id" | "display_name" | "avatar_url">;
  stories: Story[];
  /** true when every story of this author has already been seen by me */
  seen: boolean;
  /** index of the first story I have not seen yet (0 when all unseen) */
  firstUnseen: number;
  latestAt: string;
};


const STORY_COLS =
  "id, author_id, kind, media_url, caption, background, text_color, overlays, drawing, duration_ms, visibility, created_at, expires_at, author:profiles!stories_author_id_fkey(id, display_name, avatar_url)";

// FlowText brand-aligned story backgrounds: ink, clay, teal, amber — no greens.
export const STORY_BACKGROUNDS = [
  "#262b33",
  "#b4522f",
  "#2f6b66",
  "#c07f14",
  "#3b2f6b",
  "#7a1f3d",
  "#8a4b2a",
  "#141414",
];

export const STORY_TEXT_COLORS = ["#ffffff", "#111111", "#ffd166", "#e9dcc6", "#ffb3c1"];

export const STORY_STICKERS = [
  "😀","😍","😂","🥳","😎","🤩","🥰","😭","🔥","💯","✨","🌈","❤️","💙","💚","⭐","☀️","🌙","🎉","🎂","🍕","☕","⚽","🎧","📸","🚀","🌍","🏆","💡","🙌","👏","🤝",
];

/** All non-expired stories I'm allowed to see, grouped by author, unseen first. */
export async function fetchStoryTray(userId: string): Promise<StoryGroup[]> {
  const { data, error } = await supabase
    .from("stories")
    .select(STORY_COLS)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  const stories = (data ?? []) as unknown as Story[];
  if (stories.length === 0) return [];

  const { data: views } = await supabase
    .from("story_views")
    .select("story_id")
    .eq("user_id", userId)
    .in(
      "story_id",
      stories.map((story) => story.id),
    );
  const seenIds = new Set((views ?? []).map((view) => view.story_id));

  const groups = new Map<string, StoryGroup>();
  for (const story of stories) {
    const author = story.author ?? {
      id: story.author_id,
      display_name: "FlowText member",
      avatar_url: null,
    };
    const group = groups.get(story.author_id) ?? {
      author,
      stories: [] as Story[],
      seen: true,
      firstUnseen: 0,
      latestAt: story.created_at,
    };
    const unseen = !seenIds.has(story.id) && story.author_id !== userId;
    if (unseen && group.seen) group.firstUnseen = group.stories.length;
    group.stories.push(story);
    if (unseen) group.seen = false;
    if (story.created_at > group.latestAt) group.latestAt = story.created_at;
    groups.set(story.author_id, group);
  }

  return [...groups.values()].sort((a, b) => {
    // mine always first, then unseen, then most recent
    if (a.author.id === userId) return -1;
    if (b.author.id === userId) return 1;
    if (a.seen !== b.seen) return a.seen ? 1 : -1;
    return b.latestAt.localeCompare(a.latestAt);
  });
}

/** Live updates: fires whenever a story or story view changes. */
export function subscribeToStories(onChange: () => void) {
  const channel = supabase
    .channel("stories-live")
    .on("postgres_changes", { event: "*", schema: "public", table: "stories" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "story_views" }, onChange)
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}


export async function createStory(input: {
  authorId: string;
  kind: StoryKind;
  mediaUrl?: string | null;
  caption?: string | null;
  background: string;
  textColor: string;
  overlays: StoryOverlay[];
  drawing?: string | null;
  durationMs: number;
  visibility: StoryVisibility;
  excludeIds?: string[];
}) {
  const { data, error } = await supabase
    .from("stories")
    .insert({
      author_id: input.authorId,
      kind: input.kind,
      media_url: input.mediaUrl ?? null,
      caption: input.caption ?? null,
      background: input.background,
      text_color: input.textColor,
      overlays: input.overlays as unknown as never,
      drawing: input.drawing ?? null,
      duration_ms: input.durationMs,
      visibility: input.visibility,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const excludes = input.excludeIds ?? [];
  if (excludes.length > 0) {
    const { error: exError } = await supabase
      .from("story_excludes")
      .insert(excludes.map((id) => ({ story_id: data.id, user_id: id })));
    if (exError) throw new Error(exError.message);
  }
  return data.id as string;
}

export async function markStoryViewed(storyId: string, userId: string) {
  await supabase.from("story_views").upsert({ story_id: storyId, user_id: userId });
}

export async function deleteStory(id: string) {
  const { error } = await supabase.from("stories").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function storyViewers(storyId: string) {
  const { data, error } = await supabase
    .from("story_views")
    .select("user_id, created_at, viewer:profiles!story_views_user_id_fkey(id, display_name, avatar_url)")
    .eq("story_id", storyId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as {
    user_id: string;
    created_at: string;
    viewer: Pick<Profile, "id" | "display_name" | "avatar_url"> | null;
  }[];
}

/** Friends the author can choose to hide a story from. */
export async function fetchFriendChoices(userId: string) {
  const ids = await friendIdsOf(userId);
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", ids)
    .order("display_name");
  if (error) throw new Error(error.message);
  return (data ?? []) as Pick<Profile, "id" | "display_name" | "avatar_url">[];
}

export function storyTimeLabel(iso: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
}
