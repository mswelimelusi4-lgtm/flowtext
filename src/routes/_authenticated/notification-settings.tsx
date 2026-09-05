import { createFileRoute, Link, useRouteContext } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell, EmptyNote, RailCard } from "@/components/flowtext/AppShell";
import {
  fetchNotificationPrefs,
  saveNotificationPrefs,
  type DeliveryMethod,
  type NotificationPrefs,
} from "@/lib/profile";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/notification-settings")({
  head: () => ({
    meta: [
      { title: "Notification settings — FlowText" },
      {
        name: "description",
        content: "Choose which FlowText notifications you receive and how each one reaches you.",
      },
      { property: "og:title", content: "Notification settings — FlowText" },
      { property: "og:description", content: "Turn categories on or off and pick push, email or none." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotificationSettingsPage,
});

type Category = {
  label: string;
  hint: string;
  toggle: keyof NotificationPrefs;
  delivery?: keyof NotificationPrefs;
};

const CATEGORIES: Category[] = [
  { label: "Likes and reactions", hint: "When someone reacts to your posts or comments", toggle: "on_like", delivery: "delivery_like" },
  { label: "Comments and replies", hint: "Comments on your posts and replies to your comments", toggle: "on_comment", delivery: "delivery_comment" },
  { label: "Friend requests", hint: "New requests and accepted requests", toggle: "on_friend_request", delivery: "delivery_friend_request" },
  { label: "Messages", hint: "New messages in your conversations", toggle: "on_message", delivery: "delivery_message" },
  { label: "Group activity", hint: "New posts and new members in your groups", toggle: "on_group_activity", delivery: "delivery_group_activity" },
  { label: "Reminders", hint: "Friends' birthdays and other reminders", toggle: "on_reminder" },
];

const METHODS: DeliveryMethod[] = ["push", "email", "none"];

function NotificationSettingsPage() {
  const { userId } = useRouteContext({ from: "/_authenticated" });
  const queryClient = useQueryClient();

  const prefs = useQuery({
    queryKey: ["notif-prefs", userId],
    queryFn: () => fetchNotificationPrefs(userId),
  });

  const save = useMutation({
    mutationFn: (patch: Partial<NotificationPrefs>) => saveNotificationPrefs(userId, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notif-prefs", userId] }),
    onError: (error: Error) => toast.error(error.message),
  });

  const data = prefs.data;

  return (
    <AppShell
      userId={userId}
      rail={
        <RailCard title="Good to know">
          <EmptyNote>
            Turning a category off stops those notifications from being created at all — nothing is
            hidden after the fact.
          </EmptyNote>
        </RailCard>
      }
    >
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold">Notification settings</h1>
        <Link to="/notifications" className="text-[11px] text-teal-deep hover:underline">
          Back to notifications
        </Link>
      </div>

      <div className="mt-4 space-y-2">
        {prefs.isLoading && [0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-bone-soft" />)}

        {data &&
          CATEGORIES.map((category) => {
            const on = Boolean(data[category.toggle]);
            return (
              <section
                key={category.label}
                className="rounded-2xl bg-card p-4 ring-1 ring-black/5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-sm font-semibold">{category.label}</p>
                    <p className="mt-0.5 text-[11px] text-ink-soft">{category.hint}</p>
                  </div>
                  <button
                    role="switch"
                    aria-checked={on}
                    aria-label={`${category.label} notifications`}
                    onClick={() => save.mutate({ [category.toggle]: !on } as Partial<NotificationPrefs>)}
                    className={cn(
                      "relative h-6 w-11 shrink-0 rounded-full transition",
                      on ? "bg-teal-deep" : "bg-ink/20",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 size-5 rounded-full bg-bone transition",
                        on ? "left-[1.4rem]" : "left-0.5",
                      )}
                    />
                  </button>
                </div>

                {category.delivery && (
                  <div className="font-display mt-3 flex gap-1">
                    {METHODS.map((method) => {
                      const active = data[category.delivery!] === method;
                      return (
                        <button
                          key={method}
                          disabled={!on}
                          onClick={() =>
                            save.mutate({ [category.delivery!]: method } as Partial<NotificationPrefs>)
                          }
                          className={cn(
                            "rounded-full px-3 py-1 text-[11px] font-semibold capitalize disabled:opacity-40",
                            active ? "bg-ink text-bone" : "bg-bone-soft text-ink-soft",
                          )}
                        >
                          {method}
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
      </div>
    </AppShell>
  );
}
