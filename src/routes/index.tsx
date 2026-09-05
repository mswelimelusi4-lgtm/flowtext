import { createFileRoute, Link } from "@tanstack/react-router";
import { Wordmark } from "@/components/flowtext/Wordmark";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FlowText — a social current for your people" },
      {
        name: "description",
        content:
          "FlowText is a social network for sharing posts, photos and video, threading conversations, joining groups and messaging friends.",
      },
      { property: "og:title", content: "FlowText — a social current for your people" },
      {
        property: "og:description",
        content: "Share posts, thread conversations, join groups and message friends on FlowText.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const HIGHLIGHTS = [
  {
    title: "One continuous feed",
    body: "Posts from friends and the pages you follow, in a thread you can actually follow.",
  },
  {
    title: "Threads, not shouting",
    body: "Nested comments with their own reactions keep long conversations readable.",
  },
  {
    title: "Groups and messages",
    body: "Private group chats, 1:1 messages and topic groups with their own feeds.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-bone text-ink">
      <div className="chrome-bar h-1.5 w-full" />

      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <Wordmark className="text-2xl" />
        <Link
          to="/auth"
          className="font-display rounded-full bg-ink px-4 py-2 text-xs font-semibold text-bone hover:bg-ink-soft"
        >
          Sign in
        </Link>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-20">
        <section className="py-14 text-center">
          <p className="font-display text-[11px] font-semibold tracking-[0.3em] text-clay-deep uppercase">
            Social, in flow
          </p>
          <h1 className="font-display mx-auto mt-4 max-w-2xl text-4xl leading-[1.05] font-bold text-balance sm:text-6xl">
            Everything your people are saying, in one current.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-ink-soft">
            FlowText is a warm, chrome-edged social network: profiles, friends, follows, a media-rich
            feed, groups, pages and real-time messaging.
          </p>
          <Link
            to="/auth"
            className="font-display mt-8 inline-flex rounded-full bg-clay px-6 py-3 text-sm font-semibold text-bone hover:bg-clay-deep"
          >
            Join FlowText
          </Link>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          {HIGHLIGHTS.map((item, index) => (
            <article
              key={item.title}
              className="relative rounded-2xl bg-card p-5 ring-1 ring-black/5"
            >
              <span className="font-display text-[11px] font-bold text-amber">
                0{index + 1}
              </span>
              <h2 className="font-display mt-2 text-base font-semibold">{item.title}</h2>
              <p className="mt-2 text-xs leading-relaxed text-ink-soft">{item.body}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
