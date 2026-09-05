import { createFileRoute, Link, useRouteContext } from "@tanstack/react-router";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell, EmptyNote, RailCard } from "@/components/flowtext/AppShell";
import { Composer } from "@/components/flowtext/Composer";
import { PostCard } from "@/components/flowtext/PostCard";
import { UserAvatar } from "@/components/flowtext/UserAvatar";
import {
  PAGE_SIZE,
  fetchGroup,
  fetchGroupFeed,
  fetchGroupMembers,
  fetchGroupMemberships,
  joinGroup,
  leaveGroup,
} from "@/lib/api";

export const Route = createFileRoute("/_authenticated/groups/$groupId")({
  head: () => ({
    meta: [
      { title: "Group feed — FlowText" },
      { name: "description", content: "A FlowText group: its own feed, members and conversations." },
      { property: "og:title", content: "Group feed — FlowText" },
      { property: "og:description", content: "Posts and members inside this FlowText group." },
    ],
  }),
  component: GroupPage,
});

function GroupPage() {
  const { userId } = useRouteContext({ from: "/_authenticated" });
  const { groupId } = Route.useParams();
  const queryClient = useQueryClient();

  const group = useQuery({ queryKey: ["group", groupId], queryFn: () => fetchGroup(groupId) });
  const members = useQuery({
    queryKey: ["group-members", groupId],
    queryFn: () => fetchGroupMembers(groupId),
  });
  const memberships = useQuery({
    queryKey: ["memberships", userId],
    queryFn: () => fetchGroupMemberships(userId),
  });
  const joined = (memberships.data ?? []).includes(groupId);

  const feed = useInfiniteQuery({
    queryKey: ["group-feed", groupId],
    queryFn: ({ pageParam }) => fetchGroupFeed(groupId, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.length < PAGE_SIZE ? undefined : all.length),
    enabled: joined,
  });

  const toggle = useMutation({
    mutationFn: () => (joined ? leaveGroup(groupId, userId) : joinGroup(groupId, userId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["memberships", userId] });
      queryClient.invalidateQueries({ queryKey: ["group-members", groupId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const posts = feed.data?.pages.flat() ?? [];

  return (
    <AppShell
      userId={userId}
      rail={
        <RailCard title={`Members (${members.data?.length ?? 0})`}>
          {(members.data ?? []).length === 0 && <EmptyNote>No members yet.</EmptyNote>}
          <ul className="space-y-2">
            {(members.data ?? []).slice(0, 10).map((member) => (
              <li key={member.id} className="flex items-center gap-2">
                <UserAvatar name={member.display_name} src={member.avatar_url} className="size-8" />
                <Link
                  to="/profile/$userId"
                  params={{ userId: member.id }}
                  className="font-display truncate text-xs font-semibold hover:text-clay-deep"
                >
                  {member.display_name}
                </Link>
              </li>
            ))}
          </ul>
        </RailCard>
      }
    >
      <section className="overflow-hidden rounded-2xl bg-card ring-1 ring-black/5">
        <div className="chrome-bar h-24" />
        <div className="flex flex-wrap items-center gap-3 p-5">
          <div className="flex-1">
            <h1 className="font-display text-xl font-bold">{group.data?.name ?? "Group"}</h1>
            <p className="mt-1 text-xs text-ink-soft">
              {group.data?.privacy === "private" ? "Private group" : "Public group"} ·{" "}
              {members.data?.length ?? 0} members
            </p>
          </div>
          <button
            onClick={() => toggle.mutate()}
            className="font-display rounded-full bg-clay px-4 py-1.5 text-xs font-semibold text-bone hover:bg-clay-deep"
          >
            {joined ? "Leave group" : "Join group"}
          </button>
        </div>
        {group.data?.description && (
          <p className="px-5 pb-5 text-xs leading-relaxed text-ink-soft">{group.data.description}</p>
        )}
      </section>

      {joined ? (
        <div className="mt-5">
          <Composer userId={userId} groupId={groupId} />
          <div className="thread-line mt-4 space-y-4">
            {feed.isLoading && <div className="h-32 animate-pulse rounded-2xl bg-bone-soft" />}
            {!feed.isLoading && posts.length === 0 && (
              <p className="rounded-2xl bg-bone-soft/60 p-6 text-center text-xs text-ink-soft ring-1 ring-black/5">
                Nothing posted in this group yet — you can start it off.
              </p>
            )}
            {posts.map((post) => (
              <PostCard key={post.id} post={post} userId={userId} dotTone="teal" />
            ))}
            {feed.hasNextPage && (
              <button
                onClick={() => feed.fetchNextPage()}
                className="font-display w-full rounded-full py-2.5 text-sm font-semibold text-ink-soft ring-1 ring-ink/10 hover:bg-bone-soft"
              >
                Load more
              </button>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-5 rounded-2xl bg-bone-soft/60 p-6 text-center text-xs text-ink-soft ring-1 ring-black/5">
          Join this group to see its feed and post.
        </p>
      )}
    </AppShell>
  );
}
