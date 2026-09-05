import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, EmptyNote, RailCard } from "@/components/flowtext/AppShell";
import { PostCard } from "@/components/flowtext/PostCard";
import { fetchPost } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/post/$postId")({
  head: () => ({
    meta: [
      { title: "Post — FlowText" },
      { name: "description", content: "A single FlowText post with its reactions and comments." },
      { property: "og:title", content: "Post — FlowText" },
      { property: "og:description", content: "Read the post, its reactions and the whole comment thread." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PostPage,
});

function PostPage() {
  const { userId } = useRouteContext({ from: "/_authenticated" });
  const { postId } = Route.useParams();

  const post = useQuery({ queryKey: ["post", postId], queryFn: () => fetchPost(postId) });

  return (
    <AppShell
      userId={userId}
      rail={
        <RailCard title="About this view">
          <EmptyNote>You opened this post from a notification. React or reply right here.</EmptyNote>
        </RailCard>
      }
    >
      <h1 className="font-display text-xl font-semibold">Post</h1>

      <div className="mt-4">
        {post.isLoading && <div className="h-48 animate-pulse rounded-2xl bg-bone-soft" />}
        {!post.isLoading && !post.data && (
          <p className="rounded-2xl bg-bone-soft/60 p-6 text-center text-xs text-ink-soft ring-1 ring-black/5">
            This post is no longer available.
          </p>
        )}
        {post.data && <PostCard post={post.data} userId={userId} />}
      </div>
    </AppShell>
  );
}
