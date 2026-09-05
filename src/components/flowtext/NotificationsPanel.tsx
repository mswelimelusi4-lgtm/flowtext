import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BellOff,
  Check,
  MessageCircle,
  MessagesSquare,
  MoreHorizontal,
  Trash2,
  UserPlus,
  Users,
  Cake,
  ThumbsUp,
} from "lucide-react";
import { UserAvatar } from "./UserAvatar";
import { cn } from "@/lib/utils";
import {
  fetchNotificationRecords,
  groupNotifications,
  markAllRead,
  markNotificationsRead,
  muteNotificationSource,
  notificationBadge,
  notificationSentence,
  relativeTime,
  removeNotifications,
  type NotificationGroup,
} from "@/lib/notifications";

const BADGE_ICON = {
  like: ThumbsUp,
  comment: MessageCircle,
  friend: UserPlus,
  message: MessagesSquare,
  group: Users,
  reminder: Cake,
} as const;

const BADGE_TONE = {
  like: "bg-teal text-bone",
  comment: "bg-clay text-bone",
  friend: "bg-ink text-bone",
  message: "bg-teal-deep text-bone",
  group: "bg-amber text-ink",
  reminder: "bg-clay-deep text-bone",
} as const;

type Tab = "all" | "unread";

export function NotificationsList({
  userId,
  compact = false,
  onNavigate,
}: {
  userId: string;
  compact?: boolean;
  onNavigate?: () => void;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("all");
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const notes = useQuery({
    queryKey: ["notifications", userId],
    queryFn: () => fetchNotificationRecords(userId),
  });

  const groups = useMemo(() => groupNotifications(notes.data ?? []), [notes.data]);
  const visible = tab === "unread" ? groups.filter((g) => g.unread) : groups;

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
    queryClient.invalidateQueries({ queryKey: ["unread-notifications", userId] });
  }

  const setRead = useMutation({
    mutationFn: (input: { ids: string[]; read: boolean }) =>
      markNotificationsRead(input.ids, input.read),
    onSuccess: refresh,
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (ids: string[]) => removeNotifications(ids),
    onSuccess: refresh,
    onError: (error: Error) => toast.error(error.message),
  });

  const mute = useMutation({
    mutationFn: (input: { kind: "post" | "actor"; targetId: string }) =>
      muteNotificationSource(userId, input.kind, input.targetId),
    onSuccess: () => toast.success("Notifications turned off for this one"),
    onError: (error: Error) => toast.error(error.message),
  });

  const readAll = useMutation({
    mutationFn: () => markAllRead(userId),
    onSuccess: refresh,
    onError: (error: Error) => toast.error(error.message),
  });

  function open(group: NotificationGroup) {
    if (group.unread) setRead.mutate({ ids: group.ids, read: true });
    onNavigate?.();
    const actorId = group.actors[0]?.id;

    switch (group.type) {
      case "message":
        navigate({ to: "/messages", search: { thread: group.target_id ?? undefined } });
        return;

      case "friend_request":
        navigate({ to: "/friends" });
        return;
      case "group_member":
        if (group.target_id) navigate({ to: "/groups/$groupId", params: { groupId: group.target_id } });
        return;
      case "friend_accepted":
      case "follow":
      case "birthday":
        if (actorId) navigate({ to: "/profile/$userId", params: { userId: actorId } });
        return;
      default:
        if (group.target_id) navigate({ to: "/post/$postId", params: { postId: group.target_id } });
        else if (actorId) navigate({ to: "/profile/$userId", params: { userId: actorId } });
    }
  }

  const hasUnread = groups.some((g) => g.unread);

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 px-1 pb-2">
        <div className="font-display flex gap-1">
          {(["all", "unread"] as Tab[]).map((value) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={cn(
                "rounded-full px-3 py-1 text-[11px] font-semibold capitalize",
                tab === value ? "bg-ink text-bone" : "bg-bone-soft text-ink-soft",
              )}
            >
              {value}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => readAll.mutate()}
            disabled={!hasUnread || readAll.isPending}
            className="text-[11px] text-teal-deep underline-offset-2 hover:underline disabled:opacity-40"
          >
            Mark all as read
          </button>
          <Link
            to="/notification-settings"
            onClick={onNavigate}
            aria-label="Notification settings"
            className="rounded-full p-1 text-ink-soft hover:bg-bone-soft"
          >
            <MoreHorizontal className="size-4" />
          </Link>
        </div>
      </div>

      <div className={cn("min-h-0 space-y-1 overflow-y-auto pr-1", compact ? "max-h-[26rem]" : "")}>
        {notes.isLoading &&
          [0, 1, 2].map((index) => (
            <div key={index} className="h-16 animate-pulse rounded-2xl bg-bone-soft" />
          ))}

        {!notes.isLoading && visible.length === 0 && (
          <p className="rounded-2xl bg-bone-soft/60 p-6 text-center text-xs text-ink-soft ring-1 ring-black/5">
            {tab === "unread" ? "No unread notifications." : "Nothing yet — activity will show up here."}
          </p>
        )}

        {visible.map((group) => {
          const badge = notificationBadge(group.type);
          const Icon = BADGE_ICON[badge];
          const actor = group.actors[0];
          return (
            <div
              key={group.key}
              className={cn(
                "group relative flex items-start gap-3 rounded-2xl p-3 text-left ring-1 ring-black/5 transition",
                group.unread ? "bg-bone-soft" : "bg-card",
              )}
              onContextMenu={(event) => {
                event.preventDefault();
                setOpenMenu(group.key);
              }}
            >
              <button
                onClick={() => open(group)}
                className="flex min-w-0 flex-1 items-start gap-3 text-left"
              >
                <span className="relative shrink-0">
                  <UserAvatar
                    name={actor?.display_name ?? "Someone"}
                    src={actor?.avatar_url}
                    className="size-10"
                  />
                  <span
                    className={cn(
                      "absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full ring-2 ring-bone",
                      BADGE_TONE[badge],
                    )}
                  >
                    <Icon className="size-3" />
                  </span>
                </span>

                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block text-xs",
                      group.unread ? "text-ink" : "text-ink-soft/80",
                    )}
                  >
                    {notificationSentence(group)}
                  </span>
                  <span className="mt-1 block text-[10px] text-ink-soft/70">
                    {relativeTime(group.created_at)}
                  </span>
                </span>
              </button>

              <div className="flex shrink-0 items-center gap-2 pt-1">
                {group.unread && <span className="size-2 rounded-full bg-teal-deep" />}
                <button
                  aria-label="Notification options"
                  onClick={() => setOpenMenu(openMenu === group.key ? null : group.key)}
                  className="rounded-full p-1 text-ink-soft opacity-0 transition group-hover:opacity-100 focus:opacity-100"
                >
                  <MoreHorizontal className="size-4" />
                </button>
              </div>

              {openMenu === group.key && (
                <div className="absolute top-10 right-2 z-20 w-56 overflow-hidden rounded-2xl bg-card text-xs shadow-lg ring-1 ring-black/10">
                  <button
                    onClick={() => {
                      setRead.mutate({ ids: group.ids, read: group.unread });
                      setOpenMenu(null);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 hover:bg-bone-soft"
                  >
                    <Check className="size-3.5" />
                    {group.unread ? "Mark as read" : "Mark as unread"}
                  </button>
                  <button
                    onClick={() => {
                      remove.mutate(group.ids);
                      setOpenMenu(null);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 hover:bg-bone-soft"
                  >
                    <Trash2 className="size-3.5" />
                    Remove this notification
                  </button>
                  {group.target_id && notificationBadge(group.type) !== "message" && (
                    <button
                      onClick={() => {
                        mute.mutate({ kind: "post", targetId: group.target_id! });
                        setOpenMenu(null);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 hover:bg-bone-soft"
                    >
                      <BellOff className="size-3.5" />
                      Turn off for this post
                    </button>
                  )}
                  {actor && (
                    <button
                      onClick={() => {
                        mute.mutate({ kind: "actor", targetId: actor.id });
                        setOpenMenu(null);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 hover:bg-bone-soft"
                    >
                      <BellOff className="size-3.5" />
                      Turn off for {actor.display_name}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
