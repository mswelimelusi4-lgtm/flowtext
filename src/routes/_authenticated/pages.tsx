import { useState } from "react";
import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell, EmptyNote, RailCard } from "@/components/flowtext/AppShell";
import { UserAvatar } from "@/components/flowtext/UserAvatar";
import { createPage, fetchPageFollows, fetchPages, togglePageFollow } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/pages")({
  head: () => ({
    meta: [
      { title: "Pages — FlowText" },
      {
        name: "description",
        content: "Follow brands, creators and businesses with their own FlowText pages.",
      },
      { property: "og:title", content: "Pages — FlowText" },
      { property: "og:description", content: "Discover and follow FlowText pages." },
    ],
  }),
  component: PagesPage,
});

function PagesPage() {
  const { userId } = useRouteContext({ from: "/_authenticated" });
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");

  const pages = useQuery({ queryKey: ["pages"], queryFn: fetchPages });
  const follows = useQuery({
    queryKey: ["page-follows", userId],
    queryFn: () => fetchPageFollows(userId),
  });
  const followed = new Set(follows.data ?? []);

  const create = useMutation({
    mutationFn: () =>
      createPage({ name: name.trim(), description: description.trim(), category: category.trim(), createdBy: userId }),
    onSuccess: () => {
      setName("");
      setCategory("");
      setDescription("");
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["pages"] });
      queryClient.invalidateQueries({ queryKey: ["page-follows", userId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggle = useMutation({
    mutationFn: ({ pageId, following }: { pageId: string; following: boolean }) =>
      togglePageFollow(pageId, userId, following),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["page-follows", userId] }),
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell
      userId={userId}
      rail={
        <RailCard title="Pages you follow">
          {followed.size === 0 && <EmptyNote>You aren't following any pages yet.</EmptyNote>}
          <ul className="space-y-1.5 text-xs">
            {(pages.data ?? [])
              .filter((page) => followed.has(page.id))
              .map((page) => (
                <li key={page.id} className="font-display font-semibold">
                  {page.name}
                </li>
              ))}
          </ul>
        </RailCard>
      }
    >
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold">Pages</h1>
        <button
          onClick={() => setOpen((value) => !value)}
          className="font-display rounded-full bg-ink px-3 py-1.5 text-[11px] font-semibold text-bone"
        >
          {open ? "Close" : "Create page"}
        </button>
      </div>

      {open && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) return;
            create.mutate();
          }}
          className="mt-4 space-y-3 rounded-2xl bg-card p-4 ring-1 ring-black/5"
        >
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Page name"
            className="w-full rounded-xl bg-bone-soft px-3 py-2 text-sm outline-none ring-1 ring-ink/10 focus:ring-teal/40"
          />
          <input
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            placeholder="Category (e.g. Music, Coffee shop)"
            className="w-full rounded-xl bg-bone-soft px-3 py-2 text-sm outline-none ring-1 ring-ink/10 focus:ring-teal/40"
          />
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What is this page about?"
            rows={3}
            className="w-full rounded-xl bg-bone-soft px-3 py-2 text-sm outline-none ring-1 ring-ink/10 focus:ring-teal/40"
          />
          <button
            type="submit"
            disabled={create.isPending || !name.trim()}
            className="font-display rounded-full bg-clay px-4 py-1.5 text-xs font-semibold text-bone disabled:opacity-40"
          >
            {create.isPending ? "Creating…" : "Create page"}
          </button>
        </form>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {pages.isLoading &&
          [0, 1].map((index) => (
            <div key={index} className="h-28 animate-pulse rounded-2xl bg-bone-soft" />
          ))}
        {!pages.isLoading && (pages.data ?? []).length === 0 && (
          <p className="rounded-2xl bg-bone-soft/60 p-5 text-xs text-ink-soft ring-1 ring-black/5 sm:col-span-2">
            No pages exist yet — create the first one.
          </p>
        )}
        {(pages.data ?? []).map((page) => {
          const following = followed.has(page.id);
          return (
            <article key={page.id} className="rounded-2xl bg-card p-4 ring-1 ring-black/5">
              <div className="flex items-center gap-3">
                <UserAvatar name={page.name} src={page.avatar_url} className="size-10" />
                <div className="min-w-0">
                  <h2 className="font-display truncate text-sm font-semibold">{page.name}</h2>
                  <p className="text-[11px] text-ink-soft">{page.category ?? "Page"}</p>
                </div>
              </div>
              {page.description && (
                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-ink-soft">
                  {page.description}
                </p>
              )}
              <button
                onClick={() => toggle.mutate({ pageId: page.id, following })}
                className={`font-display mt-3 rounded-full px-3 py-1.5 text-[11px] font-semibold ${
                  following ? "bg-bone-soft text-ink-soft" : "bg-teal text-bone"
                }`}
              >
                {following ? "Following" : "Follow"}
              </button>
            </article>
          );
        })}
      </div>
    </AppShell>
  );
}
