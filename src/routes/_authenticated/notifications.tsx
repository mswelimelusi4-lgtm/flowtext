import { createFileRoute, Link, useRouteContext } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell, EmptyNote, RailCard } from "@/components/flowtext/AppShell";
import { UserAvatar } from "@/components/flowtext/UserAvatar";
import { fetchNotifications, markAllNotificationsRead } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — FlowText" },
      {
        name: "description",
        content: "Friend requests, reactions, comments and messages waiting for you on FlowText.",
      },
      { property: "og:title", content: "Notifications — FlowText" },
      { property: "og:description", content: "Everything that happened while you were away." },
    ],
  }),
  component: NotificationsPage,
});

const LABEL: Record<string, string> = {
  friend_request: "sent you a friend request",
  friend_accept: "accepted your friend request",
  reaction: "reacted to your post",
  comment: "commented on your post",
  mention: "mentioned you",
  message: "sent you a message",
  share: "shared your post",
};

function NotificationsPage() {
  const { userId } = useRouteContext({ from: "/_authenticated" });
  const queryClient = useQueryClient();

  const notes = useQuery({
    queryKey: ["notifications", userId],
    queryFn: () => fetchNotifications(userId),
  });

  const readAll = useMutation({
    mutationFn: () => markAllNotificationsRead(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
      queryClient.invalidateQueries({ queryKey: ["unread-notifications", userId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = notes.data ?? [];

  return (
    <AppShell
      userId={userId}
      rail={
        <RailCard title="Tip">
          <EmptyNote>
            Reactions, comments and friend requests all land here. Mark them read to clear the badge.
          </EmptyNote>
        </RailCard>
      }
    >
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold">Notifications</h1>
        <button
          onClick={() => readAll.mutate()}
          disabled={readAll.isPending || rows.every((r) => r.read_at)}
          className="font-display rounded-full bg-ink px-3 py-1.5 text-[11px] font-semibold text-bone disabled:opacity-40"
        >
          Mark all read
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {notes.isLoading &&
          [0, 1, 2].map((index) => (
            <div key={index} className="h-16 animate-pulse rounded-2xl bg-bone-soft" />
          ))}

        {!notes.isLoading && rows.length === 0 && (
          <p className="rounded-2xl bg-bone-soft/60 p-6 text-center text-xs text-ink-soft ring-1 ring-black/5">
            Nothing yet — activity from your network will show up here.
          </p>
        )}

        {rows.map((note) => (
          <article
            key={note.id}
            className={`flex items-start gap-3 rounded-2xl p-3 ring-1 ring-black/5 ${
              note.read_at ? "bg-card" : "bg-bone-soft"
            }`}
          >
            <UserAvatar
              name={note.actor?.display_name ?? "Someone"}
              src={note.actor?.avatar_url}
              className="size-9"
            />
            <div className="min-w-0 flex-1 text-xs">
              <p className="text-ink">
                {note.actor ? (
                  <Link
                    to="/profile/$userId"
                    params={{ userId: note.actor.id }}
                    className="font-display font-semibold hover:text-clay-deep"
                  >
                    {note.actor.display_name}
                  </Link>
                ) : (
                  <span className="font-display font-semibold">Someone</span>
                )}{" "}
                {LABEL[note.type] ?? note.type}
              </p>
              {note.body && <p className="mt-1 truncate text-ink-soft">{note.body}</p>}
              <p className="mt-1 text-[10px] text-ink-soft/70">
                {new Date(note.created_at).toLocaleString()}
              </p>
            </div>
            {!note.read_at && <span className="mt-1 size-2 rounded-full bg-clay" />}
          </article>
        ))}
      </div>
    </AppShell>
  );
}
