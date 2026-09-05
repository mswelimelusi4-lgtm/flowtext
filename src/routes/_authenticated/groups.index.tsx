import { useState } from "react";
import { createFileRoute, Link, useNavigate, useRouteContext } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell, EmptyNote, RailCard } from "@/components/flowtext/AppShell";
import {
  createGroup,
  fetchGroupMemberships,
  fetchGroups,
  joinGroup,
  leaveGroup,
} from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/groups/")({
  head: () => ({
    meta: [
      { title: "Groups — FlowText" },
      {
        name: "description",
        content: "Join or create FlowText groups around a topic, each with its own feed.",
      },
      { property: "og:title", content: "Groups — FlowText" },
      { property: "og:description", content: "Public and private FlowText groups with their own feeds." },
    ],
  }),
  component: GroupsPage,
});

function GroupsPage() {
  const { userId } = useRouteContext({ from: "/_authenticated" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", privacy: "public" as "public" | "private" });

  const groups = useQuery({ queryKey: ["groups"], queryFn: fetchGroups });
  const memberships = useQuery({
    queryKey: ["memberships", userId],
    queryFn: () => fetchGroupMemberships(userId),
  });

  const mine = new Set(memberships.data ?? []);

  const create = useMutation({
    mutationFn: () =>
      createGroup({
        name: form.name.trim(),
        description: form.description.trim(),
        privacy: form.privacy,
        createdBy: userId,
      }),
    onSuccess: (groupId) => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      queryClient.invalidateQueries({ queryKey: ["memberships", userId] });
      setOpen(false);
      setForm({ name: "", description: "", privacy: "public" });
      navigate({ to: "/groups/$groupId", params: { groupId } });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggle = useMutation({
    mutationFn: ({ groupId, joined }: { groupId: string; joined: boolean }) =>
      joined ? leaveGroup(groupId, userId) : joinGroup(groupId, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["memberships", userId] }),
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell
      userId={userId}
      rail={
        <RailCard title="Your groups">
          {mine.size === 0 && <EmptyNote>You haven't joined a group yet.</EmptyNote>}
          <ul className="space-y-1.5">
            {(groups.data ?? [])
              .filter((group) => mine.has(group.id))
              .map((group) => (
                <li key={group.id}>
                  <Link
                    to="/groups/$groupId"
                    params={{ groupId: group.id }}
                    className="font-display text-xs font-semibold hover:text-clay-deep"
                  >
                    {group.name}
                  </Link>
                </li>
              ))}
          </ul>
        </RailCard>
      }
    >
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Groups</h1>
        <button
          onClick={() => setOpen((v) => !v)}
          className="font-display rounded-full bg-clay px-4 py-1.5 text-xs font-semibold text-bone hover:bg-clay-deep"
        >
          {open ? "Close" : "Create group"}
        </button>
      </div>

      {open && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!form.name.trim()) return;
            create.mutate();
          }}
          className="mt-4 space-y-3 rounded-2xl bg-card p-5 ring-1 ring-black/5"
        >
          <input
            value={form.name}
            onChange={(event) => setForm((c) => ({ ...c, name: event.target.value }))}
            placeholder="Group name"
            className="w-full rounded-xl bg-bone-soft px-3 py-2 text-sm outline-none ring-1 ring-ink/10 focus:ring-teal/40"
          />
          <textarea
            value={form.description}
            rows={2}
            onChange={(event) => setForm((c) => ({ ...c, description: event.target.value }))}
            placeholder="What's this group about?"
            className="w-full resize-none rounded-xl bg-bone-soft px-3 py-2 text-sm outline-none ring-1 ring-ink/10 focus:ring-teal/40"
          />
          <div className="font-display flex gap-2">
            {(["public", "private"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setForm((c) => ({ ...c, privacy: option }))}
                className={cn(
                  "rounded-full px-3 py-1 text-[11px] font-semibold",
                  form.privacy === option ? "bg-teal text-bone" : "text-ink-soft ring-1 ring-ink/10",
                )}
              >
                {option === "public" ? "Public" : "Private"}
              </button>
            ))}
          </div>
          <button
            type="submit"
            disabled={create.isPending}
            className="font-display rounded-full bg-ink px-4 py-2 text-xs font-semibold text-bone disabled:opacity-50"
          >
            {create.isPending ? "Creating…" : "Create group"}
          </button>
        </form>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {groups.isLoading &&
          [0, 1].map((index) => (
            <div key={index} className="h-28 animate-pulse rounded-2xl bg-bone-soft" />
          ))}
        {groups.data?.length === 0 && (
          <p className="rounded-2xl bg-bone-soft/60 p-5 text-xs text-ink-soft ring-1 ring-black/5 sm:col-span-2">
            No groups exist yet — create the first one.
          </p>
        )}
        {(groups.data ?? []).map((group) => {
          const joined = mine.has(group.id);
          return (
            <article key={group.id} className="rounded-2xl bg-card p-4 ring-1 ring-black/5">
              <div className="flex items-start justify-between gap-2">
                <Link
                  to="/groups/$groupId"
                  params={{ groupId: group.id }}
                  className="font-display text-sm font-semibold hover:text-clay-deep"
                >
                  {group.name}
                </Link>
                <span className="font-display rounded-full bg-bone-soft px-2 py-0.5 text-[10px] font-semibold text-ink-soft">
                  {group.privacy}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-ink-soft">
                {group.description || "No description yet."}
              </p>
              <button
                onClick={() => toggle.mutate({ groupId: group.id, joined })}
                className={cn(
                  "font-display mt-3 rounded-full px-3 py-1 text-[11px] font-semibold",
                  joined ? "text-ink-soft ring-1 ring-ink/15" : "bg-teal text-bone",
                )}
              >
                {joined ? "Leave group" : "Join group"}
              </button>
            </article>
          );
        })}
      </div>
    </AppShell>
  );
}
