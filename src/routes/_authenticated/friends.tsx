import { useState } from "react";
import { createFileRoute, Link, useRouteContext } from "@tanstack/react-router";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell, EmptyNote, RailCard } from "@/components/flowtext/AppShell";
import { UserAvatar } from "@/components/flowtext/UserAvatar";
import {
  acceptFriendRequest,
  fetchFollowing,
  fetchFriendEdges,
  fetchSuggestions,
  friendIdsOf,
  getProfile,
  mutualCount,
  removeFriendEdge,
  sendFriendRequest,
  toggleFollow,
} from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/friends")({
  head: () => ({
    meta: [
      { title: "Friends — FlowText" },
      {
        name: "description",
        content: "Your FlowText friends, pending requests, people you follow and new suggestions.",
      },
      { property: "og:title", content: "Friends — FlowText" },
      { property: "og:description", content: "Manage friends, requests and follows on FlowText." },
    ],
  }),
  component: FriendsPage,
});

type Tab = "friends" | "requests" | "following" | "suggested";

function FriendsPage() {
  const { userId } = useRouteContext({ from: "/_authenticated" });
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("friends");
  const [term, setTerm] = useState("");

  const friendIds = useQuery({ queryKey: ["friend-ids", userId], queryFn: () => friendIdsOf(userId) });
  const edges = useQuery({ queryKey: ["edges", userId], queryFn: () => fetchFriendEdges(userId) });
  const following = useQuery({ queryKey: ["following", userId], queryFn: () => fetchFollowing(userId) });
  const suggestions = useQuery({
    queryKey: ["suggestions", userId],
    queryFn: () => fetchSuggestions(userId),
  });

  const pending = (edges.data ?? []).filter((edge) => edge.status === "pending");

  const ids =
    tab === "friends" ? (friendIds.data ?? []) : tab === "following" ? (following.data ?? []) : [];

  const people = useQueries({
    queries: ids.map((id) => ({ queryKey: ["profile", id], queryFn: () => getProfile(id) })),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["edges", userId] });
    queryClient.invalidateQueries({ queryKey: ["friend-ids", userId] });
    queryClient.invalidateQueries({ queryKey: ["following", userId] });
    queryClient.invalidateQueries({ queryKey: ["suggestions", userId] });
  };

  const accept = useMutation({
    mutationFn: (edge: { id: string; requester_id: string }) =>
      acceptFriendRequest(edge.id, edge.requester_id, userId),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });
  const drop = useMutation({
    mutationFn: (edgeId: string) => removeFriendEdge(edgeId),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });
  const add = useMutation({
    mutationFn: (targetId: string) => sendFriendRequest(userId, targetId),
    onSuccess: () => {
      invalidate();
      toast.success("Request sent");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const unfollow = useMutation({
    mutationFn: (targetId: string) => toggleFollow(userId, targetId, true),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  const visible = people
    .map((query) => query.data)
    .filter((profile): profile is NonNullable<typeof profile> => Boolean(profile))
    .filter((profile) => profile.display_name.toLowerCase().includes(term.toLowerCase()));

  const TABS: { key: Tab; label: string }[] = [
    { key: "friends", label: `Friends (${friendIds.data?.length ?? 0})` },
    { key: "requests", label: `Requests (${pending.length})` },
    { key: "following", label: `Following (${following.data?.length ?? 0})` },
    { key: "suggested", label: "Suggested" },
  ];

  return (
    <AppShell
      userId={userId}
      rail={
        <RailCard title="How connections work">
          <EmptyNote>
            Friending goes both ways and needs an accept. Following is one-way — good for public
            figures and pages.
          </EmptyNote>
        </RailCard>
      }
    >
      <h1 className="font-display text-2xl font-bold">Your network</h1>

      <div className="font-display mt-4 flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold",
              tab === item.key ? "bg-ink text-bone" : "text-ink-soft ring-1 ring-ink/10",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {(tab === "friends" || tab === "following") && (
        <input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search this list"
          className="mt-4 w-full rounded-full bg-bone-soft px-4 py-2 text-sm outline-none ring-1 ring-ink/10 focus:ring-teal/40 sm:w-72"
        />
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {(tab === "friends" || tab === "following") && (
          <>
            {ids.length === 0 && (
              <EmptyCard>
                {tab === "friends"
                  ? "No friends yet — check the Suggested tab."
                  : "You're not following anyone yet."}
              </EmptyCard>
            )}
            {visible.map((profile) => (
              <PersonCard
                key={profile.id}
                id={profile.id}
                name={profile.display_name}
                avatar={profile.avatar_url}
                myId={userId}
                action={
                  tab === "following"
                    ? { label: "Unfollow", run: () => unfollow.mutate(profile.id) }
                    : undefined
                }
              />
            ))}
          </>
        )}

        {tab === "requests" && (
          <>
            {pending.length === 0 && <EmptyCard>No pending requests.</EmptyCard>}
            {pending.map((edge) => {
              const otherId = edge.requester_id === userId ? edge.addressee_id : edge.requester_id;
              const incoming = edge.addressee_id === userId;
              return (
                <PersonCard
                  key={edge.id}
                  id={otherId}
                  myId={userId}
                  action={
                    incoming
                      ? {
                          label: "Accept",
                          run: () => accept.mutate({ id: edge.id, requester_id: edge.requester_id }),
                        }
                      : { label: "Cancel", run: () => drop.mutate(edge.id) }
                  }
                  secondary={incoming ? { label: "Decline", run: () => drop.mutate(edge.id) } : undefined}
                />
              );
            })}
          </>
        )}

        {tab === "suggested" && (
          <>
            {(suggestions.data ?? []).length === 0 && (
              <EmptyCard>No suggestions right now.</EmptyCard>
            )}
            {(suggestions.data ?? []).map(({ profile, mutual }) => (
              <PersonCard
                key={profile.id}
                id={profile.id}
                name={profile.display_name}
                avatar={profile.avatar_url}
                myId={userId}
                note={mutual > 0 ? `${mutual} mutual friend${mutual > 1 ? "s" : ""}` : "New here"}
                action={{ label: "Add friend", run: () => add.mutate(profile.id) }}
              />
            ))}
          </>
        )}
      </div>
    </AppShell>
  );
}

function EmptyCard({ children }: { children: string }) {
  return (
    <p className="rounded-2xl bg-bone-soft/60 p-5 text-xs text-ink-soft ring-1 ring-black/5 sm:col-span-2">
      {children}
    </p>
  );
}

function PersonCard({
  id,
  myId,
  name,
  avatar,
  note,
  action,
  secondary,
}: {
  id: string;
  myId: string;
  name?: string;
  avatar?: string | null;
  note?: string;
  action?: { label: string; run: () => void } | undefined;
  secondary?: { label: string; run: () => void } | undefined;
}) {
  const profile = useQuery({
    queryKey: ["profile", id],
    queryFn: () => getProfile(id),
    enabled: !name,
  });
  const mutual = useQuery({
    queryKey: ["mutual", myId, id],
    queryFn: () => mutualCount(myId, id),
    enabled: !note,
  });

  const label = name ?? profile.data?.display_name ?? "Member";
  const src = avatar ?? profile.data?.avatar_url;

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-card p-4 ring-1 ring-black/5">
      <Link to="/profile/$userId" params={{ userId: id }}>
        <UserAvatar name={label} src={src} className="size-11" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          to="/profile/$userId"
          params={{ userId: id }}
          className="font-display block truncate text-sm font-semibold hover:text-clay-deep"
        >
          {label}
        </Link>
        <p className="text-[11px] text-ink-soft">
          {note ??
            (mutual.data
              ? `${mutual.data} mutual friend${mutual.data > 1 ? "s" : ""}`
              : "No mutual friends")}
        </p>
      </div>
      <div className="flex flex-col gap-1">
        {action && (
          <button
            onClick={action.run}
            className="font-display rounded-full bg-clay px-3 py-1 text-[11px] font-semibold text-bone hover:bg-clay-deep"
          >
            {action.label}
          </button>
        )}
        {secondary && (
          <button
            onClick={secondary.run}
            className="font-display rounded-full px-3 py-1 text-[11px] font-semibold text-ink-soft ring-1 ring-ink/10"
          >
            {secondary.label}
          </button>
        )}
      </div>
    </div>
  );
}
