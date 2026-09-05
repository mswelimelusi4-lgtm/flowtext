import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  REACTIONS,
  addComment,
  createPost,
  deletePost,
  fetchComments,
  fetchPostMeta,
  notify,
  setReaction,
  type Comment,
  type Post,
  type ReactionType,
} from "@/lib/api";
import { UserAvatar } from "./UserAvatar";
import { cn } from "@/lib/utils";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString();
}

const VISIBILITY_LABEL: Record<Post["visibility"], string> = {
  public: "Public",
  friends: "Friends-only",
  private: "Only me",
};

export function PostCard({
  post,
  userId,
  dotTone = "clay",
}: {
  post: Post;
  userId: string;
  dotTone?: "clay" | "teal" | "amber" | undefined;
}) {
  const queryClient = useQueryClient();
  const [showComments, setShowComments] = useState(false);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");

  const meta = useQuery({
    queryKey: ["post-meta", post.id, userId],
    queryFn: () => fetchPostMeta(post.id, userId),
  });

  const comments = useQuery({
    queryKey: ["comments", post.id],
    queryFn: () => fetchComments(post.id),
    enabled: showComments,
  });

  const react = useMutation({
    mutationFn: async (type: ReactionType) => {
      await setReaction({ userId, type, postId: post.id, current: meta.data?.mine ?? null });
      if (meta.data?.mine !== type) {
        await notify({
          userId: post.author_id,
          actorId: userId,
          type: "reaction",
          targetId: post.id,
          body: type,
        });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["post-meta", post.id, userId] }),
    onError: (error: Error) => toast.error(error.message),
  });

  const comment = useMutation({
    mutationFn: async (input: { content: string; parentId: string | null }) => {
      await addComment({
        postId: post.id,
        authorId: userId,
        content: input.content,
        parentCommentId: input.parentId,
      });
      await notify({
        userId: post.author_id,
        actorId: userId,
        type: "comment",
        targetId: post.id,
        body: input.content.slice(0, 90),
      });
    },
    onSuccess: () => {
      setDraft("");
      setReplyDraft("");
      setReplyTo(null);
      queryClient.invalidateQueries({ queryKey: ["comments", post.id] });
      queryClient.invalidateQueries({ queryKey: ["post-meta", post.id, userId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const share = useMutation({
    mutationFn: () =>
      createPost({
        authorId: userId,
        content: `Shared from ${post.author?.display_name ?? "a member"}: "${post.content.slice(0, 200)}"`,
        mediaUrls: post.media_urls,
        mediaType: post.media_type,
        visibility: "public",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      toast.success("Shared to your feed");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: () => deletePost(post.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      queryClient.invalidateQueries({ queryKey: ["group-feed"] });
      queryClient.invalidateQueries({ queryKey: ["user-posts"] });
      toast.success("Post removed");
    },
  });

  const roots = (comments.data ?? []).filter((c) => !c.parent_comment_id);
  const repliesOf = (id: string) => (comments.data ?? []).filter((c) => c.parent_comment_id === id);

  const dot =
    dotTone === "teal" ? "bg-teal" : dotTone === "amber" ? "bg-amber" : "bg-clay";

  return (
    <article className="rise relative rounded-2xl bg-card p-4 ring-1 ring-black/5">
      <span className={cn("absolute -left-[15px] top-5 hidden size-2.5 rounded-full lg:block", dot)} />

      <div className="flex items-center gap-3">
        <Link to="/profile/$userId" params={{ userId: post.author_id }}>
          <UserAvatar name={post.author?.display_name ?? "Member"} src={post.author?.avatar_url} />
        </Link>
        <div className="min-w-0">
          <Link
            to="/profile/$userId"
            params={{ userId: post.author_id }}
            className="font-display block text-sm font-semibold hover:text-clay-deep"
          >
            {post.author?.display_name ?? "Member"}
          </Link>
          <p className="text-xs text-ink-soft">
            {timeAgo(post.created_at)} ·{" "}
            <span className={post.visibility === "public" ? "text-teal" : "text-clay-deep"}>
              {VISIBILITY_LABEL[post.visibility]}
            </span>
          </p>
        </div>
        {post.author_id === userId && (
          <button
            onClick={() => remove.mutate()}
            className="ml-auto text-xs text-ink-soft hover:text-destructive"
          >
            Delete
          </button>
        )}
      </div>

      {post.content && (
        <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap text-pretty">{post.content}</p>
      )}

      {post.media_urls.length > 0 && (
        <div
          className={cn(
            "mt-3 grid gap-2",
            post.media_urls.length > 1 ? "grid-cols-2" : "grid-cols-1",
          )}
        >
          {post.media_urls.map((url) =>
            post.media_type === "video" ? (
              <video
                key={url}
                src={url}
                controls
                className="w-full rounded-xl bg-bone-soft ring-1 ring-black/5"
              />
            ) : (
              <img
                key={url}
                src={url}
                alt=""
                loading="lazy"
                className="w-full rounded-xl bg-bone-soft object-cover ring-1 ring-black/5"
              />
            ),
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {REACTIONS.map((reaction) => {
          const count = meta.data?.counts[reaction.type] ?? 0;
          const active = meta.data?.mine === reaction.type;
          if (count === 0 && !active && reaction.type !== "like" && reaction.type !== "love")
            return (
              <button
                key={reaction.type}
                onClick={() => react.mutate(reaction.type)}
                className="pill-pop rounded-full px-2.5 py-1 text-xs font-medium text-ink-soft ring-1 ring-ink/10"
              >
                {reaction.glyph}
              </button>
            );
          return (
            <button
              key={reaction.type}
              onClick={() => react.mutate(reaction.type)}
              className={cn(
                "pill-pop rounded-full px-3 py-1 text-xs font-medium",
                active
                  ? "bg-clay text-bone ring-1 ring-clay"
                  : reaction.type === "love"
                    ? "bg-amber/15 text-ink ring-1 ring-amber/30"
                    : "bg-clay/10 text-clay-deep ring-1 ring-clay/20",
              )}
            >
              {reaction.label}
              {count > 0 ? ` · ${count}` : ""}
            </button>
          );
        })}
        <button
          onClick={() => share.mutate()}
          className="pill-pop rounded-full bg-teal/10 px-3 py-1 text-xs font-medium text-teal-deep ring-1 ring-teal/20"
        >
          Share
        </button>
        <button
          onClick={() => setShowComments((v) => !v)}
          className="ml-auto text-xs text-ink-soft hover:text-ink"
        >
          {meta.data?.commentCount ?? 0} comments
        </button>
      </div>

      {showComments && (
        <div className="mt-3 space-y-3 border-l-2 border-teal/20 pl-4">
          {comments.isLoading && <p className="text-xs text-ink-soft">Loading the thread…</p>}
          {comments.data?.length === 0 && (
            <p className="text-xs text-ink-soft">No comments yet — start the thread.</p>
          )}
          {roots.map((root) => (
            <div key={root.id}>
              <CommentRow comment={root} userId={userId} postId={post.id} />
              <div className="mt-2 space-y-2 border-l-2 border-amber/30 pl-4">
                {repliesOf(root.id).map((reply) => (
                  <CommentRow key={reply.id} comment={reply} userId={userId} postId={post.id} />
                ))}
              </div>
              <button
                onClick={() => setReplyTo(replyTo === root.id ? null : root.id)}
                className="mt-1 text-[11px] font-semibold text-clay-deep"
              >
                Reply
              </button>
              {replyTo === root.id && (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!replyDraft.trim()) return;
                    comment.mutate({ content: replyDraft.trim(), parentId: root.id });
                  }}
                  className="mt-1 flex gap-2"
                >
                  <input
                    value={replyDraft}
                    onChange={(event) => setReplyDraft(event.target.value)}
                    placeholder="Write a reply…"
                    className="flex-1 rounded-full bg-bone-soft px-3 py-1.5 text-xs outline-none ring-1 ring-ink/10 focus:ring-teal/40"
                  />
                  <button
                    type="submit"
                    className="font-display rounded-full bg-teal px-3 py-1 text-xs font-semibold text-bone"
                  >
                    Send
                  </button>
                </form>
              )}
            </div>
          ))}

          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!draft.trim()) return;
              comment.mutate({ content: draft.trim(), parentId: null });
            }}
            className="flex gap-2 pt-1"
          >
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Add a comment…"
              className="flex-1 rounded-full bg-bone-soft px-3 py-1.5 text-xs outline-none ring-1 ring-ink/10 focus:ring-teal/40"
            />
            <button
              type="submit"
              disabled={comment.isPending}
              className="font-display rounded-full bg-teal px-3 py-1 text-xs font-semibold text-bone disabled:opacity-50"
            >
              Post
            </button>
          </form>
        </div>
      )}
    </article>
  );
}

function CommentRow({
  comment,
  userId,
  postId,
}: {
  comment: Comment;
  userId: string;
  postId: string;
}) {
  const queryClient = useQueryClient();
  const likes = useQuery({
    queryKey: ["comment-likes", comment.id],
    queryFn: async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase
        .from("reactions")
        .select("user_id")
        .eq("comment_id", comment.id);
      return {
        count: data?.length ?? 0,
        mine: (data ?? []).some((r) => r.user_id === userId),
      };
    },
  });

  const like = useMutation({
    mutationFn: () =>
      setReaction({
        userId,
        type: "like",
        commentId: comment.id,
        current: likes.data?.mine ? "like" : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comment-likes", comment.id] });
      queryClient.invalidateQueries({ queryKey: ["post-meta", postId, userId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div>
      <Link
        to="/profile/$userId"
        params={{ userId: comment.author_id }}
        className="font-display text-xs font-semibold hover:text-clay-deep"
      >
        {comment.author?.display_name ?? "Member"}
      </Link>
      <p className="text-sm text-ink-soft">{comment.content}</p>
      <button
        onClick={() => like.mutate()}
        className={cn(
          "pill-pop mt-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
          likes.data?.mine
            ? "bg-clay text-bone ring-1 ring-clay"
            : "bg-clay/10 text-clay-deep ring-1 ring-clay/20",
        )}
      >
        Like{likes.data?.count ? ` · ${likes.data.count}` : ""}
      </button>
    </div>
  );
}
