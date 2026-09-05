import { useEffect, useRef, useState } from "react";
import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell, EmptyNote, RailCard } from "@/components/flowtext/AppShell";
import { UserAvatar } from "@/components/flowtext/UserAvatar";
import {
  fetchMessages,
  fetchThreads,
  markThreadRead,
  sendMessage,
  type ThreadSummary,
} from "@/lib/api";

export const Route = createFileRoute("/_authenticated/messages")({
  validateSearch: (search: Record<string, unknown>) => ({
    thread: typeof search["thread"] === "string" ? (search["thread"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Messages — FlowText" },
      {
        name: "description",
        content: "Direct and group chats on FlowText, with unread indicators and live updates.",
      },
      { property: "og:title", content: "Messages — FlowText" },
      { property: "og:description", content: "Your FlowText inbox: 1:1 and group conversations." },
    ],
  }),
  component: MessagesPage,
});

function threadName(thread: ThreadSummary, userId: string) {
  if (thread.title) return thread.title;
  const others = thread.participants.filter((p) => p.id !== userId);
  if (others.length === 0) return "You";
  return others.map((p) => p.display_name).join(", ");
}

function MessagesPage() {
  const { userId } = useRouteContext({ from: "/_authenticated" });
  const { thread: threadParam } = Route.useSearch();
  const navigate = Route.useNavigate();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  const threads = useQuery({
    queryKey: ["threads", userId],
    queryFn: () => fetchThreads(userId),
    refetchInterval: 15000,
  });

  const activeId = threadParam ?? threads.data?.[0]?.id;

  const messages = useQuery({
    queryKey: ["messages", activeId],
    queryFn: () => fetchMessages(activeId as string),
    enabled: Boolean(activeId),
    refetchInterval: 8000,
  });

  useEffect(() => {
    if (!activeId) return;
    void markThreadRead(activeId, userId).then(() => {
      queryClient.invalidateQueries({ queryKey: ["threads", userId] });
    });
  }, [activeId, userId, queryClient]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.data?.length, activeId]);

  const send = useMutation({
    mutationFn: () =>
      sendMessage({ threadId: activeId as string, senderId: userId, content: draft.trim() }),
    onSuccess: () => {
      setDraft("");
      queryClient.invalidateQueries({ queryKey: ["messages", activeId] });
      queryClient.invalidateQueries({ queryKey: ["threads", userId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const list = threads.data ?? [];
  const active = list.find((t) => t.id === activeId);

  return (
    <AppShell
      userId={userId}
      rail={
        <RailCard title="Inbox">
          <EmptyNote>
            Start a chat from someone's profile with the Message button, or pick a conversation here.
          </EmptyNote>
        </RailCard>
      }
    >
      <h1 className="font-display text-xl font-semibold">Messages</h1>

      <div className="mt-4 grid gap-4 md:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="space-y-1.5">
          {threads.isLoading &&
            [0, 1, 2].map((index) => (
              <div key={index} className="h-14 animate-pulse rounded-xl bg-bone-soft" />
            ))}
          {!threads.isLoading && list.length === 0 && (
            <p className="rounded-xl bg-bone-soft/60 p-4 text-xs text-ink-soft ring-1 ring-black/5">
              No conversations yet.
            </p>
          )}
          {list.map((thread) => (
            <button
              key={thread.id}
              onClick={() => navigate({ to: ".", search: { thread: thread.id } })}
              className={`w-full rounded-xl p-3 text-left ring-1 ring-black/5 ${
                thread.id === activeId ? "bg-ink text-bone" : "bg-card hover:bg-bone-soft"
              }`}
            >
              <span className="font-display flex items-center justify-between text-xs font-semibold">
                <span className="truncate">{threadName(thread, userId)}</span>
                {thread.unread > 0 && (
                  <span className="ml-2 grid size-4 place-items-center rounded-full bg-clay text-[9px] font-bold text-bone">
                    {thread.unread}
                  </span>
                )}
              </span>
              <span
                className={`mt-1 block truncate text-[11px] ${
                  thread.id === activeId ? "text-bone/70" : "text-ink-soft"
                }`}
              >
                {thread.lastMessage ?? "No messages yet"}
              </span>
            </button>
          ))}
        </aside>

        <section className="flex min-h-[420px] flex-col rounded-2xl bg-card ring-1 ring-black/5">
          {!activeId ? (
            <div className="grid flex-1 place-items-center p-6 text-center text-xs text-ink-soft">
              Pick a conversation to start reading.
            </div>
          ) : (
            <>
              <header className="font-display border-b border-ink/10 px-4 py-3 text-sm font-semibold">
                {active ? threadName(active, userId) : "Conversation"}
              </header>

              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {messages.isLoading &&
                  [0, 1, 2].map((index) => (
                    <div key={index} className="h-10 animate-pulse rounded-xl bg-bone-soft" />
                  ))}
                {!messages.isLoading && (messages.data ?? []).length === 0 && (
                  <p className="text-center text-xs text-ink-soft">
                    No messages yet — say hello below.
                  </p>
                )}
                {(messages.data ?? []).map((message) => {
                  const mine = message.sender_id === userId;
                  return (
                    <div
                      key={message.id}
                      className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}
                    >
                      {!mine && (
                        <UserAvatar
                          name={message.sender?.display_name ?? "User"}
                          src={message.sender?.avatar_url}
                          className="size-7"
                        />
                      )}
                      <div
                        className={`max-w-[75%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                          mine ? "bg-ink text-bone" : "bg-bone-soft text-ink"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{message.content}</p>
                        <p className={`mt-1 text-[10px] ${mine ? "text-bone/60" : "text-ink-soft/70"}`}>
                          {new Date(message.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!draft.trim()) return;
                  send.mutate();
                }}
                className="flex items-center gap-2 border-t border-ink/10 p-3"
              >
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Write a message"
                  aria-label="Message"
                  className="flex-1 rounded-full bg-bone-soft px-4 py-2 text-sm outline-none ring-1 ring-ink/10 focus:ring-teal/40"
                />
                <button
                  type="submit"
                  disabled={send.isPending || !draft.trim()}
                  className="font-display rounded-full bg-clay px-4 py-2 text-xs font-semibold text-bone disabled:opacity-40"
                >
                  Send
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </AppShell>
  );
}
