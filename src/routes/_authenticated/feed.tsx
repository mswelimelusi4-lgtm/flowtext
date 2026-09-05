import { useState } from "react";
import { createFileRoute, Link, useRouteContext } from "@tanstack/react-router";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell, EmptyNote, RailCard } from "@/components/flowtext/AppShell";
import { Composer } from "@/components/flowtext/Composer";
import { PostCard } from "@/components/flowtext/PostCard";
import { StoriesTray } from "@/components/flowtext/StoriesTray";
import { UserAvatar } from "@/components/flowtext/UserAvatar";
import {
  PAGE_SIZE,
  acceptFriendRequest,
  fetchFeed,
  fetchFriendEdges,
  fetchPages,
  fetchSuggestions,
  getProfile,
  removeFriendEdge,
  sendFriendRequest,
} from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/feed")({
  head: () => ({
    meta: [
      { title: "Your feed — FlowText" },
      {
        name: "description",
        content: "The FlowText current: posts, photos and video from your friends and pages.",
      },
      { property: "og:title", content: "Your feed — FlowText" },
      { property: "og:description", content: "Posts from your friends and the pages you follow." },
    ],
  }),
  component: FeedPage,
});

const TONES = ["clay", "teal", "amber"] as const;

function FeedPage() {
  const { userId } = useRouteContext({ from: "/_authenticated" });
  const [order, setOrder] = useState<"recent" | "top">("recent");

  const feed = useInfiniteQuery({
    queryKey: ["feed", userId, order],
    queryFn: ({ pageParam }) => fetchFeed(userId, pageParam, order),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.length < PAGE_SIZE ? undefined : all.length),
  });

  const posts = feed.data?.pages.flat() ?? [];

  return (
    <AppShell userId={userId} rail={<FeedRail userId={userId} />}>
      <StoriesTray userId={userId} />
      <Composer userId={userId} />

      <div className="font-display mt-5 flex items-center gap-2">
        {(["recent", "top"] as const).map((option) => (
          <button
            key={option}
            onClick={() => setOrder(option)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold",
              order === option ? "bg-ink text-bone" : "text-ink-soft ring-1 ring-ink/10",
            )}
          >
            {option === "recent" ? "Newest first" : "Most talked about"}
          </button>
        ))}
      </div>

      <div className="thread-line mt-4 space-y-4">
        {feed.isLoading &&
          [0, 1, 2].map((index) => (
            <div key={index} className="h-40 animate-pulse rounded-2xl bg-bone-soft" />
          ))}

        {!feed.isLoading && posts.length === 0 && (
          <div className="rounded-2xl bg-bone-soft/60 p-6 text-center ring-1 ring-black/5">
            <h2 className="font-display text-base font-semibold">The current is still</h2>
            <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-ink-soft">
              Post something above, or add a few friends and follow pages — their posts will flow in
              here.
            </p>
          </div>
        )}

        {posts.map((post, index) => (
          <PostCard
            key={post.id}
            post={post}
            userId={userId}
            dotTone={TONES[index % TONES.length]}
          />
        ))}

        {feed.hasNextPage && (
          <button
            onClick={() => feed.fetchNextPage()}
            disabled={feed.isFetchingNextPage}
            className="font-display w-full rounded-full py-2.5 text-sm font-semibold text-ink-soft ring-1 ring-ink/10 hover:bg-bone-soft"
          >
            {feed.isFetchingNextPage ? "Loading…" : "Load more posts"}
          </button>
        )}
      </div>
    </AppShell>
  );
}

export function FeedRail({ userId }: { userId: string }) {
  const queryClient = useQueryClient();

  const edges = useQuery({ queryKey: ["edges", userId], queryFn: () => fetchFriendEdges(userId) });
  const suggestions = useQuery({
    queryKey: ["suggestions", userId],
    queryFn: () => fetchSuggestions(userId),
  });
  const pages = useQuery({ queryKey: ["pages"], queryFn: fetchPages });

  const pending = (edges.data ?? []).filter(
    (edge) => edge.status === "pending" && edge.addressee_id === userId,
  );

  const accept = useMutation({
    mutationFn: (edge: { id: string; requester_id: string }) =>
      acceptFriendRequest(edge.id, edge.requester_id, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["edges", userId] });
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      toast.success("You're connected");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const decline = useMutation({
    mutationFn: (edgeId: string) => removeFriendEdge(edgeId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["edges", userId] }),
  });

  const request = useMutation({
    mutationFn: (targetId: string) => sendFriendRequest(userId, targetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suggestions", userId] });
      queryClient.invalidateQueries({ queryKey: ["edges", userId] });
      toast.success("Request sent");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <>
      <RailCard title="Friend requests">
        {pending.length === 0 && <EmptyNote>No pending requests right now.</EmptyNote>}
        <ul className="space-y-3">
          {pending.map((edge) => (
            <li key={edge.id}>
              <RequesterRow
                requesterId={edge.requester_id}
                onAccept={() => accept.mutate({ id: edge.id, requester_id: edge.requester_id })}
                onDecline={() => decline.mutate(edge.id)}
              />
            </li>
          ))}
        </ul>
      </RailCard>

      <RailCard title="People you may know" tone="plain">
        {suggestions.isLoading && <EmptyNote>Looking for connections…</EmptyNote>}
        {suggestions.data?.length === 0 && (
          <EmptyNote>No suggestions yet — invite a friend to FlowText.</EmptyNote>
        )}
        <ul className="space-y-3">
          {(suggestions.data ?? []).map(({ profile, mutual }) => (
            <li key={profile.id} className="flex items-center gap-2">
              <Link to="/profile/$userId" params={{ userId: profile.id }}>
                <UserAvatar
                  name={profile.display_name}
                  src={profile.avatar_url}
                  className="size-9"
                />
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  to="/profile/$userId"
                  params={{ userId: profile.id }}
                  className="font-display block truncate text-xs font-semibold hover:text-clay-deep"
                >
                  {profile.display_name}
                </Link>
                <p className="text-[11px] text-ink-soft">
                  {mutual > 0 ? `${mutual} mutual friend${mutual > 1 ? "s" : ""}` : "New to FlowText"}
                </p>
              </div>
              <button
                onClick={() => request.mutate(profile.id)}
                className="font-display rounded-full px-2.5 py-1 text-[11px] font-semibold text-teal ring-1 ring-teal/30 hover:bg-teal hover:text-bone"
              >
                Add
              </button>
            </li>
          ))}
        </ul>
      </RailCard>

      <RailCard title="Pages to follow">
        {(pages.data ?? []).length === 0 && <EmptyNote>No pages yet.</EmptyNote>}
        <ul className="space-y-2">
          {(pages.data ?? []).slice(0, 4).map((page) => (
            <li key={page.id} className="text-xs">
              <span className="font-display block font-semibold">{page.name}</span>
              <span className="text-ink-soft">{page.category ?? "Page"}</span>
            </li>
          ))}
        </ul>
        <Link
          to="/pages"
          className="font-display mt-3 inline-block text-[11px] font-semibold text-clay-deep"
        >
          Browse all pages →
        </Link>
      </RailCard>
    </>
  );
}

function RequesterRow({
  requesterId,
  onAccept,
  onDecline,
}: {
  requesterId: string;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const { data } = useQuery({
    queryKey: ["profile", requesterId],
    queryFn: () => getProfile(requesterId),
  });

  return (
    <div className="flex items-center gap-2">
      <UserAvatar name={data?.display_name ?? "Member"} src={data?.avatar_url} className="size-9" />
      <div className="min-w-0 flex-1">
        <p className="font-display truncate text-xs font-semibold">
          {data?.display_name ?? "Member"}
        </p>
        <div className="mt-1 flex gap-1">
          <button
            onClick={onAccept}
            className="font-display rounded-full bg-clay px-2.5 py-0.5 text-[11px] font-semibold text-bone"
          >
            Accept
          </button>
          <button
            onClick={onDecline}
            className="font-display rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-ink-soft ring-1 ring-ink/10"
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}
