import { createFileRoute, Link, useRouteContext } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, EmptyNote, RailCard } from "@/components/flowtext/AppShell";
import { UserAvatar } from "@/components/flowtext/UserAvatar";
import { globalSearch } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/search")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search["q"] === "string" ? (search["q"] as string) : "",
  }),
  head: () => ({
    meta: [
      { title: "Search — FlowText" },
      {
        name: "description",
        content: "Search FlowText for people, posts, groups and pages in one place.",
      },
      { property: "og:title", content: "Search — FlowText" },
      { property: "og:description", content: "Find people, posts, groups and pages on FlowText." },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { userId } = useRouteContext({ from: "/_authenticated" });
  const { q } = Route.useSearch();
  const term = q.trim();

  const results = useQuery({
    queryKey: ["search", term],
    queryFn: () => globalSearch(term),
    enabled: term.length > 0,
  });

  const data = results.data;

  return (
    <AppShell
      userId={userId}
      rail={
        <RailCard title="Search tips">
          <EmptyNote>Search matches names of people, groups and pages, plus post text.</EmptyNote>
        </RailCard>
      }
    >
      <h1 className="font-display text-xl font-semibold">
        {term ? `Results for “${term}”` : "Search FlowText"}
      </h1>

      {!term && (
        <p className="mt-3 rounded-2xl bg-bone-soft/60 p-5 text-xs text-ink-soft ring-1 ring-black/5">
          Use the search box at the top to look for people, posts, groups and pages.
        </p>
      )}

      {term && results.isLoading && (
        <div className="mt-4 space-y-2">
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-14 animate-pulse rounded-2xl bg-bone-soft" />
          ))}
        </div>
      )}

      {term && data && (
        <div className="mt-5 space-y-6">
          <Section title={`People (${data.people.length})`} empty={data.people.length === 0}>
            <ul className="space-y-2">
              {data.people.map((person) => (
                <li key={person.id} className="flex items-center gap-3">
                  <UserAvatar name={person.display_name} src={person.avatar_url} className="size-9" />
                  <Link
                    to="/profile/$userId"
                    params={{ userId: person.id }}
                    className="font-display text-sm font-semibold hover:text-clay-deep"
                  >
                    {person.display_name}
                  </Link>
                </li>
              ))}
            </ul>
          </Section>

          <Section title={`Posts (${data.posts.length})`} empty={data.posts.length === 0}>
            <ul className="space-y-2">
              {data.posts.map((post) => (
                <li key={post.id} className="rounded-xl bg-bone-soft/60 p-3 text-xs text-ink-soft">
                  <span className="font-display block font-semibold text-ink">
                    {post.author?.display_name ?? "Someone"}
                  </span>
                  <span className="line-clamp-2">{post.content}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title={`Groups (${data.groups.length})`} empty={data.groups.length === 0}>
            <ul className="space-y-1.5 text-xs">
              {data.groups.map((group) => (
                <li key={group.id}>
                  <Link
                    to="/groups/$groupId"
                    params={{ groupId: group.id }}
                    className="font-display font-semibold hover:text-clay-deep"
                  >
                    {group.name}
                  </Link>
                  <span className="ml-2 text-ink-soft">{group.privacy}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title={`Pages (${data.pages.length})`} empty={data.pages.length === 0}>
            <ul className="space-y-1.5 text-xs">
              {data.pages.map((page) => (
                <li key={page.id}>
                  <span className="font-display font-semibold">{page.name}</span>
                  <span className="ml-2 text-ink-soft">{page.category ?? "Page"}</span>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      )}
    </AppShell>
  );
}

function Section({
  title,
  empty,
  children,
}: {
  title: string;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="font-display text-sm font-semibold text-ink-soft">{title}</h2>
      <div className="mt-2">{empty ? <EmptyNote>No matches.</EmptyNote> : children}</div>
    </section>
  );
}
