import { useRef, useState } from "react";
import { createFileRoute, Link, useNavigate, useRouteContext } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell, EmptyNote, RailCard } from "@/components/flowtext/AppShell";
import { PostCard } from "@/components/flowtext/PostCard";
import { UserAvatar } from "@/components/flowtext/UserAvatar";
import { MediaLightbox, type LightboxItem } from "@/components/flowtext/MediaLightbox";
import {
  acceptFriendRequest,
  createPost,
  fetchFollowing,
  fetchFriendEdges,
  fetchUserPosts,
  getProfile,
  mutualCount,
  removeFriendEdge,
  sendFriendRequest,
  toggleFollow,
  updateProfile,
} from "@/lib/api";
import {
  fetchExperiences,
  fetchPlaces,
  fetchProfilePhotos,
  recordProfilePhoto,
} from "@/lib/profile";
import { openDirectChat } from "@/lib/messaging";
import { uploadMedia } from "@/lib/media";

type Tab = "posts" | "photos" | "videos";

export const Route = createFileRoute("/_authenticated/profile/$userId")({
  validateSearch: (search: Record<string, unknown>): { tab?: Tab } => {
    const tab = search["tab"];
    return tab === "photos" || tab === "videos" ? { tab } : {};
  },
  head: () => ({
    meta: [
      { title: "Profile — FlowText" },
      { name: "description", content: "A FlowText member profile: posts, photos and connections." },
      { property: "og:title", content: "Profile — FlowText" },
      { property: "og:description", content: "See posts, photos and connections on FlowText." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { userId: myId } = useRouteContext({ from: "/_authenticated" });
  const { userId } = Route.useParams();
  const { tab = "posts" } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMe = userId === myId;
  const [lightbox, setLightbox] = useState<LightboxItem | null>(null);
  const avatarInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"avatar" | "cover" | null>(null);

  const profile = useQuery({ queryKey: ["profile", userId], queryFn: () => getProfile(userId) });
  const posts = useQuery({ queryKey: ["user-posts", userId], queryFn: () => fetchUserPosts(userId) });
  const edges = useQuery({ queryKey: ["edges", myId], queryFn: () => fetchFriendEdges(myId) });
  const following = useQuery({ queryKey: ["following", myId], queryFn: () => fetchFollowing(myId) });
  const experiences = useQuery({
    queryKey: ["experiences", userId],
    queryFn: () => fetchExperiences(userId),
  });
  const places = useQuery({ queryKey: ["places", userId], queryFn: () => fetchPlaces(userId) });
  const avatarHistory = useQuery({
    queryKey: ["profile-photos", userId, "avatar"],
    queryFn: () => fetchProfilePhotos(userId, "avatar"),
  });
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
    mutationFn: () => openDirectChat(myId, userId),
    onSuccess: (threadId) => navigate({ to: "/messages", search: { thread: threadId } }),
    onError: (error: Error) => toast.error(error.message),
  });

  async function pickPhoto(kind: "avatar" | "cover", files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setBusy(kind);
    try {
      const uploaded = await uploadMedia(file, myId);
      await updateProfile(myId, kind === "avatar" ? { avatar_url: uploaded.url } : { cover_url: uploaded.url });
      await recordProfilePhoto(myId, kind, uploaded.url);
      if (kind === "avatar" && profile.data?.share_avatar_updates) {
        await createPost({
          authorId: myId,
          content: "Updated their profile picture.",
          mediaUrls: [uploaded.url],
          mediaType: "image",
          visibility: profile.data.default_post_visibility ?? "public",
        });
        queryClient.invalidateQueries({ queryKey: ["feed"] });
      }
      queryClient.invalidateQueries({ queryKey: ["profile", myId] });
      queryClient.invalidateQueries({ queryKey: ["profile-photos", myId, kind] });
      queryClient.invalidateQueries({ queryKey: ["user-posts", myId] });
      toast.success(kind === "avatar" ? "Profile picture updated" : "Cover photo updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setBusy(null);
    }
  }

  const friendLabel = !edge
    ? "Add friend"
    : edge.status === "accepted"
      ? "Friends · remove"
      : edge.addressee_id === myId
        ? "Accept request"
        : "Cancel request";

  const allPosts = posts.data ?? [];
  const photos = allPosts
    .filter((post) => post.media_type === "image")
    .flatMap((post) => post.media_urls);
  const videos = allPosts
    .filter((post) => post.media_type === "video")
    .flatMap((post) => post.media_urls);

  const jobs = (experiences.data ?? []).filter((item) => item.kind === "work");
  const schools = (experiences.data ?? []).filter((item) => item.kind === "school");

  if (profile.data?.deactivated_at && !isMe) {
    return (
      <AppShell userId={myId}>
        <div className="rounded-2xl bg-card p-8 text-center ring-1 ring-black/5">
          <h1 className="font-display text-xl font-bold">This account is deactivated</h1>
          <p className="mt-2 text-xs text-ink-soft">Their profile and posts are hidden for now.</p>
        </div>
      </AppShell>
    );
  }

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
              {jobs.slice(0, 2).map((job) => (
                <Detail
                  key={job.id}
                  label="Work"
                  value={[job.title, job.organization].filter(Boolean).join(" at ")}
                />
              ))}
              {schools.slice(0, 2).map((school) => (
                <Detail
                  key={school.id}
                  label="Studied"
                  value={[school.degree, school.organization].filter(Boolean).join(" at ")}
                />
              ))}
              <Detail label="Lives in" value={profile.data?.current_city ?? profile.data?.location} />
              <Detail label="From" value={profile.data?.hometown} />
              <Detail
                label="Status"
                value={
                  profile.data?.relationship_status
                    ? profile.data.relationship_status +
                      (profile.data.partner_name ? ` with ${profile.data.partner_name}` : "")
                    : null
                }
              />
              {places.data && places.data.length > 0 && (
                <Detail
                  label="Places"
                  value={places.data.map((place) => place.name).join(", ")}
                />
              )}
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
            {profile.data?.website && (
              <a
                href={profile.data.website}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-3 block truncate text-xs font-semibold text-teal underline"
              >
                {profile.data.website}
              </a>
            )}
            <Link
              to="/about/$userId"
              params={{ userId }}
              className="font-display mt-3 inline-block text-[11px] font-semibold text-clay-deep"
            >
              See all about info →
            </Link>
          </RailCard>

          <RailCard title="Profile picture history" tone="plain">
            {(avatarHistory.data ?? []).length === 0 && <EmptyNote>No earlier pictures yet.</EmptyNote>}
            <div className="grid grid-cols-4 gap-1.5">
              {(avatarHistory.data ?? []).map((photo) => (
                <button
                  key={photo.id}
                  onClick={() => setLightbox({ url: photo.url, kind: "image" })}
                  title={new Date(photo.created_at).toLocaleDateString()}
                >
                  <img
                    src={photo.url}
                    alt=""
                    loading="lazy"
                    className="aspect-square w-full rounded-lg object-cover"
                  />
                </button>
              ))}
            </div>
          </RailCard>
        </>
      }
    >
      <section className="overflow-hidden rounded-2xl bg-card ring-1 ring-black/5">
        <div
          className="chrome-bar relative h-32 sm:h-44"
          style={
            profile.data?.cover_url
              ? {
                  backgroundImage: `url(${profile.data.cover_url})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        >
          {isMe && (
            <>
              <input
                ref={coverInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => pickPhoto("cover", event.target.files)}
              />
              <button
                onClick={() => coverInput.current?.click()}
                disabled={busy !== null}
                className="font-display absolute right-3 bottom-3 rounded-full bg-bone/90 px-3 py-1 text-[11px] font-semibold text-ink disabled:opacity-60"
              >
                {busy === "cover" ? "Uploading…" : "Change cover"}
              </button>
            </>
          )}
        </div>
        <div className="px-5 pt-0 pb-5">
          <div className="-mt-10 flex flex-wrap items-end gap-4">
            <div className="relative">
              <button
                onClick={() =>
                  profile.data?.avatar_url
                    ? setLightbox({ url: profile.data.avatar_url, kind: "image" })
                    : undefined
                }
                aria-label="View profile picture"
              >
                <UserAvatar
                  name={profile.data?.display_name ?? "Member"}
                  src={profile.data?.avatar_url}
                  className="size-24 text-2xl ring-4 ring-card"
                />
              </button>
              {isMe && (
                <>
                  <input
                    ref={avatarInput}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => pickPhoto("avatar", event.target.files)}
                  />
                  <button
                    onClick={() => avatarInput.current?.click()}
                    disabled={busy !== null}
                    className="font-display absolute -right-1 -bottom-1 rounded-full bg-ink px-2 py-1 text-[10px] font-semibold text-bone disabled:opacity-60"
                  >
                    {busy === "avatar" ? "…" : "Edit"}
                  </button>
                </>
              )}
            </div>
            <div className="flex-1">
              <h1 className="font-display text-2xl font-bold">
                {profile.data?.display_name ?? "Member"}
              </h1>
              {!isMe && (
                <p className="text-xs text-ink-soft">
                  {mutual.data ? `${mutual.data} mutual friends` : "No mutual friends yet"}
                </p>
              )}
              {isMe && profile.data?.deactivated_at && (
                <p className="text-xs font-semibold text-clay-deep">
                  Your account is deactivated — others can't see it.
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {isMe ? (
                <>
                  <Link
                    to="/settings"
                    className="font-display rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-bone"
                  >
                    Edit profile
                  </Link>
                  <Link
                    to="/account"
                    className="font-display rounded-full px-4 py-1.5 text-xs font-semibold text-ink-soft ring-1 ring-ink/15 hover:bg-bone-soft"
                  >
                    Account settings
                  </Link>
                </>
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

          <div className="font-display mt-4 flex gap-1 border-t border-ink/10 pt-3 text-xs font-semibold">
            <TabLink userId={userId} tab="posts" current={tab} label="Posts" />
            <TabLink userId={userId} tab="photos" current={tab} label="Photos" />
            <TabLink userId={userId} tab="videos" current={tab} label="Videos" />
            <Link
              to="/about/$userId"
              params={{ userId }}
              className="rounded-full px-3 py-1.5 text-ink-soft hover:bg-bone-soft"
            >
              About
            </Link>
          </div>
        </div>
      </section>

      {tab === "posts" && (
        <div className="thread-line mt-5 space-y-4">
          {posts.isLoading && <div className="h-32 animate-pulse rounded-2xl bg-bone-soft" />}
          {posts.data?.length === 0 && (
            <div className="rounded-2xl bg-bone-soft/60 p-6 text-center text-xs text-ink-soft ring-1 ring-black/5">
              {isMe ? "You haven't posted yet." : "No posts you can see yet."}
            </div>
          )}
          {allPosts.map((post) => (
            <PostCard key={post.id} post={post} userId={myId} />
          ))}
        </div>
      )}

      {tab === "photos" && (
        <MediaGrid
          loading={posts.isLoading}
          items={photos.map((url) => ({ url, kind: "image" as const }))}
          empty="No photos posted yet."
          onOpen={setLightbox}
        />
      )}

      {tab === "videos" && (
        <MediaGrid
          loading={posts.isLoading}
          items={videos.map((url) => ({ url, kind: "video" as const }))}
          empty="No videos posted yet."
          onOpen={setLightbox}
        />
      )}

      <MediaLightbox item={lightbox} onClose={() => setLightbox(null)} />
    </AppShell>
  );
}

function TabLink({
  userId,
  tab,
  current,
  label,
}: {
  userId: string;
  tab: Tab;
  current: Tab;
  label: string;
}) {
  return (
    <Link
      to="/profile/$userId"
      params={{ userId }}
      search={tab === "posts" ? {} : { tab }}
      className={
        current === tab
          ? "rounded-full bg-ink px-3 py-1.5 text-bone"
          : "rounded-full px-3 py-1.5 text-ink-soft hover:bg-bone-soft"
      }
    >
      {label}
    </Link>
  );
}

function MediaGrid({
  items,
  empty,
  loading,
  onOpen,
}: {
  items: LightboxItem[];
  empty: string;
  loading: boolean;
  onOpen: (item: LightboxItem) => void;
}) {
  if (loading) return <div className="mt-5 h-40 animate-pulse rounded-2xl bg-bone-soft" />;
  if (items.length === 0)
    return (
      <div className="mt-5 rounded-2xl bg-bone-soft/60 p-6 text-center text-xs text-ink-soft ring-1 ring-black/5">
        {empty}
      </div>
    );
  return (
    <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {items.map((item) => (
        <button
          key={item.url}
          onClick={() => onOpen(item)}
          className="overflow-hidden rounded-xl ring-1 ring-black/5"
        >
          {item.kind === "image" ? (
            <img src={item.url} alt="" loading="lazy" className="aspect-square w-full object-cover" />
          ) : (
            <video src={item.url} muted className="aspect-square w-full object-cover" />
          )}
        </button>
      ))}
    </div>
  );
}

function Detail({ label, value }: { label: string; value?: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex gap-2">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
