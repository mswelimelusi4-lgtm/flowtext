import { createFileRoute, Link, useRouteContext } from "@tanstack/react-router";
import { AppShell, EmptyNote, RailCard } from "@/components/flowtext/AppShell";
import { NotificationsList } from "@/components/flowtext/NotificationsPanel";

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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { userId } = useRouteContext({ from: "/_authenticated" });

  return (
    <AppShell
      userId={userId}
      rail={
        <RailCard title="Tip">
          <EmptyNote>
            Reactions, comments and friend requests all land here. Tap one to jump straight to it.
          </EmptyNote>
        </RailCard>
      }
    >
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold">Notifications</h1>
        <Link to="/notification-settings" className="text-[11px] text-teal-deep hover:underline">
          Notification settings
        </Link>
      </div>

      <div className="mt-4">
        <NotificationsList userId={userId} />
      </div>
    </AppShell>
  );
}
