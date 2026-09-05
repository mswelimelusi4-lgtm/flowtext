import { createFileRoute } from "@tanstack/react-router";
import { CircleHelp, LifeBuoy, ShieldCheck } from "lucide-react";
import { AppShell, RailCard, EmptyNote } from "@/components/flowtext/AppShell";

export const Route = createFileRoute("/_authenticated/help")({
  head: () => ({
    meta: [
      { title: "Help & Support · FlowText" },
      { name: "description", content: "Get help and support for your FlowText account." },
    ],
  }),
  component: HelpPage,
});

function HelpPage() {
  const { userId } = Route.useRouteContext();
  return (
    <AppShell
      userId={userId}
      rail={
        <RailCard title="Support">
          <EmptyNote>
            Need a hand? Browse the topics here or reach out and we’ll get you flowing again.
          </EmptyNote>
        </RailCard>
      }
    >
      <h1 className="font-display text-2xl font-bold">Help &amp; Support</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Answers, guides, and ways to reach the FlowText team.
      </p>

      <div className="mt-5 space-y-3">
        <section className="rounded-2xl bg-card p-4 ring-1 ring-black/5">
          <h2 className="font-display flex items-center gap-2 text-sm font-semibold">
            <CircleHelp className="size-4 text-teal" /> Frequently asked
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-ink-soft">
            <li>How do I change my profile picture? Go to your profile and tap your avatar.</li>
            <li>How do I control who sees my posts? Use the audience selector in the composer.</li>
            <li>How do I block someone? Open Account settings → Blocking.</li>
          </ul>
        </section>

        <section className="rounded-2xl bg-card p-4 ring-1 ring-black/5">
          <h2 className="font-display flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="size-4 text-teal" /> Safety &amp; privacy
          </h2>
          <p className="mt-2 text-sm text-ink-soft">
            Review your privacy choices any time from Account settings, including who can find you,
            friend requests, and your blocked list.
          </p>
        </section>

        <section className="rounded-2xl bg-card p-4 ring-1 ring-black/5">
          <h2 className="font-display flex items-center gap-2 text-sm font-semibold">
            <LifeBuoy className="size-4 text-teal" /> Contact us
          </h2>
          <p className="mt-2 text-sm text-ink-soft">
            Still stuck? Email support@flowtext.app and we’ll reply within a couple of days.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
