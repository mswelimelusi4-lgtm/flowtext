import { createFileRoute, Link, useNavigate, useRouteContext } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell, EmptyNote, RailCard } from "@/components/flowtext/AppShell";
import { PostCard } from "@/components/flowtext/PostCard";
import { UserAvatar } from "@/components/flowtext/UserAvatar";
import {
  acceptFriendRequest,
  fetchFollowing,
  fetchFriendEdges,
  fetchUserPosts,
  getProfile,
  mutualCount,
  openDirectThread,
  removeFriendEdge,
  sendFriendRequest,
  toggleFollow,
} from "@/lib/api";

export const Route = createFileRoute("/_authenticated/profile/$userId")({
  head: () => ({
    meta: [
      { title: "Profile — FlowText" },
      { name: "description", content: "A FlowText member profile: posts, photos and connections." },
      { property: "og:title", content: "Profile — FlowText" },
      { property: "og:description", content: "See posts, photos and connections on FlowText." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { userId: myId } = useRouteContext({ from: "/_authenticated" });
  const { userId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMe = userId === myId;

  const profile = useQuery({ queryKey: ["profile", userId], queryFn: () => getProfile(userId) });
  const posts = useQuery({ queryKey: ["user-posts", userId], queryFn: () => fetchUserPosts(userId) });
  const edges = useQuery({ queryKey: ["edges", myId], queryFn: () => fetchFriendEdges(myId) });
  const following = useQuery({ queryKey: ["following", myId], queryFn: () => fetchFollowing(myId) });
  const mutual = useQuery({
    queryKey: ["mutual", myId, userId],
    queryFn: () => mutualCount(myId, userId),
    enabled: !isMe,
  });

  const edge = (edges.data ?? []).find(
    (item) =>
      (item.requester_id === myId && item.addressee_id === userId) ||
      (item.requester_id === userId && item.addressee_id === myId),
  );
  const isFollowing = (following.data ?? []).includes(userId);

  const friendAction = useMutation({
    mutationFn: async () => {
      if (!edge) return sendFriendRequest(myId, userId);
      if (edge.status === "pending" && edge.addressee_id === myId)
        return acceptFriendRequest(edge.id, edge.requester_id, myId);
      return removeFriendEdge(edge.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["edges", myId] });
      queryClient.invalidateQueries({ queryKey: ["mutual", myId, userId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const follow = useMutation({
    mutationFn: () => toggleFollow(myId, userId, isFollowing),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["following", myId] }),
    onError: (error: Error) => toast.error(error.message),
  });

  const message = useMutation({
    mutationFn: () => openDirectThread(myId, userId),
    onSuccess: (threadId) => navigate({ to: "/messages", search: { thread: threadId } }),
    onError: (error: Error) => toast.error(error.message),
  });

  const friendLabel = !edge
    ? "Add friend"
    : edge.status === "accepted"
      ? "Friends · remove"
      : edge.addressee_id === myId
        ? "Accept request"
        : "Cancel request";

  const photos = (posts.data ?? [])
    .filter((post) => post.media_type === "image")
    .flatMap((post) => post.media_urls)
    .slice(0, 9);

  return (
    <AppShell
      userId={myId}
      rail={
        <>
          <RailCard title="Intro">
            {profile.data?.bio ? (
              <p className="text-xs leading-relaxed text-ink-soft">{profile.data.bio}</p>
            ) : (
              <EmptyNote>No bio yet.</EmptyNote>
            )}
            <dl className="mt-3 space-y-1.5 text-xs">
              <Detail label="Lives in" value={profile.data?.location} />
              <Detail label="Work" value={profile.data?.work} />
              <Detail label="Education" value={profile.data?.education} />
              <Detail
                label="Joined"
                value={
                  profile.data
                    ? new Date(profile.data.created_at).toLocaleDateString(undefined, {
                        month: "long",
                        year: "numeric",
                      })
                    : null
                }
              />
            </dl>
          </RailCard>

          <RailCard title="Photos" tone="plain">
            {photos.length === 0 && <EmptyNote>No photos posted yet.</EmptyNote>}
            <div className="grid grid-cols-3 gap-1.5">
              {photos.map((url) => (
                <img
                  key={url}
                  src={url}
                  alt=""
                  loading="lazy"
                  className="aspect-square w-full rounded-lg object-cover"
                />
              ))}
            </div>
          </RailCard>
        </>
      }
    >
      <section className="overflow-hidden rounded-2xl bg-card ring-1 ring-black/5">
        <div
          className="chrome-bar h-32 sm:h-44"
          style={
            profile.data?.cover_url
              ? {
                  backgroundImage: `url(${profile.data.cover_url})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        />
        <div className="px-5 pt-0 pb-5">
          <div className="-mt-10 flex flex-wrap items-end gap-4">
            <UserAvatar
              name={profile.data?.display_name ?? "Member"}
              src={profile.data?.avatar_url}
              className="size-24 text-2xl ring-4 ring-card"
            />
            <div className="flex-1">
              <h1 className="font-display text-2xl font-bold">
                {profile.data?.display_name ?? "Member"}
              </h1>
              {!isMe && (
                <p className="text-xs text-ink-soft">
                  {mutual.data ? `${mutual.data} mutual friends` : "No mutual friends yet"}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {isMe ? (
                <Link
                  to="/settings"
                  className="font-display rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-bone"
                >
                  Edit profile
                </Link>
              ) : (
                <>
                  <button
                    onClick={() => friendAction.mutate()}
                    className="font-display rounded-full bg-clay px-4 py-1.5 text-xs font-semibold text-bone hover:bg-clay-deep"
                  >
                    {friendLabel}
                  </button>
                  <button
                    onClick={() => follow.mutate()}
                    className="font-display rounded-full px-4 py-1.5 text-xs font-semibold text-teal ring-1 ring-teal/30 hover:bg-teal hover:text-bone"
                  >
                    {isFollowing ? "Following" : "Follow"}
                  </button>
                  <button
                    onClick={() => message.mutate()}
                    className="font-display rounded-full px-4 py-1.5 text-xs font-semibold text-ink-soft ring-1 ring-ink/15 hover:bg-bone-soft"
                  >
                    Message
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="thread-line mt-5 space-y-4">
        {posts.isLoading && <div className="h-32 animate-pulse rounded-2xl bg-bone-soft" />}
        {posts.data?.length === 0 && (
          <div className="rounded-2xl bg-bone-soft/60 p-6 text-center text-xs text-ink-soft ring-1 ring-black/5">
            {isMe ? "You haven't posted yet." : "No posts you can see yet."}
          </div>
        )}
        {(posts.data ?? []).map((post) => (
          <PostCard key={post.id} post={post} userId={myId} />
        ))}
      </div>
    </AppShell>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-2">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
