import { useEffect, useState } from "react";
import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell, EmptyNote, RailCard } from "@/components/flowtext/AppShell";
import { ChatPanel, GroupInfoPanel, InboxPanel } from "@/components/flowtext/Messenger";
import { uploadMedia } from "@/lib/media";
import {
  acceptRequest,
  addThreadMembers,
  deleteThreadForMe,
  fetchChatMessages,
  fetchInbox,
  fetchParticipantReads,
  friendProfiles,
  markThreadRead,
  markThreadUnread,
  reactToMessage,
  removeThreadMember,
  sendChatMessage,
  setThreadArchived,
  setThreadMuted,
  unsendMessage,
  updateThreadInfo,
  type InboxThread,
} from "@/lib/messaging";
import { useInboxRealtime, usePresence, useThreadChannel } from "@/lib/usePresence";

export const Route = createFileRoute("/_authenticated/messages")({
  validateSearch: (search: Record<string, unknown>) => ({
    thread: typeof search["thread"] === "string" ? (search["thread"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Messages — FlowText" },
      {
        name: "description",
        content:
          "Your FlowText inbox: live chats, message requests, reactions, replies and voice notes.",
      },
      { property: "og:title", content: "Messages — FlowText" },
      { property: "og:description", content: "Chat in real time with friends and groups on FlowText." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MessagesPage,
});

function MessagesPage() {
  const { userId } = useRouteContext({ from: "/_authenticated" });
  const { thread: threadParam } = Route.useSearch();
  const navigate = Route.useNavigate();
  const queryClient = useQueryClient();
  const [showInfo, setShowInfo] = useState(false);
  const presence = usePresence(userId);

  const inbox = useQuery({
    queryKey: ["inbox", userId],
    queryFn: () => fetchInbox(userId),
    refetchInterval: 30000,
  });

  const list = inbox.data ?? [];
  const accepted = list.filter((t) => t.state === "accepted" && !t.archived);
  const activeId = threadParam ?? accepted[0]?.id;
  const active = list.find((t) => t.id === activeId);

  const refreshInbox = () => queryClient.invalidateQueries({ queryKey: ["inbox", userId] });
  useInboxRealtime(userId, refreshInbox);

  const messages = useQuery({
    queryKey: ["chat", activeId],
    queryFn: () => fetchChatMessages(activeId as string),
    enabled: Boolean(activeId),
  });

  const reads = useQuery({
    queryKey: ["chat-reads", activeId],
    queryFn: () => fetchParticipantReads(activeId as string),
    enabled: Boolean(activeId),
    refetchInterval: 15000,
  });

  const friends = useQuery({
    queryKey: ["friend-profiles", userId],
    queryFn: () => friendProfiles(userId),
  });

  const { typingIds, sendTyping } = useThreadChannel(activeId, userId, () => {
    void queryClient.invalidateQueries({ queryKey: ["chat", activeId] });
    void queryClient.invalidateQueries({ queryKey: ["chat-reads", activeId] });
    refreshInbox();
  });

  useEffect(() => {
    if (!activeId) return;
    void markThreadRead(activeId, userId).then(refreshInbox);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, userId, messages.data?.length]);

  const run = (task: () => Promise<unknown>) =>
    task()
      .then(() => {
        refreshInbox();
        void queryClient.invalidateQueries({ queryKey: ["chat", activeId] });
      })
      .catch((error: Error) => toast.error(error.message));

  const send = useMutation({
    mutationFn: (input: { content: string; mediaUrl?: string | null; kind?: string; replyToId?: string | null }) =>
      sendChatMessage({
        threadId: activeId as string,
        senderId: userId,
        content: input.content,
        mediaUrl: input.mediaUrl ?? null,
        kind: input.kind ?? "text",
        replyToId: input.replyToId ?? null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["chat", activeId] });
      refreshInbox();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rowActions = (thread: InboxThread) => ({
    onMute: () => void run(() => setThreadMuted(thread.id, userId, !thread.muted)),
    onArchive: () => void run(() => setThreadArchived(thread.id, userId, !thread.archived)),
    onDelete: () => void run(() => deleteThreadForMe(thread.id, userId)),
    onToggleRead: () =>
      void run(() =>
        thread.unread > 0 ? markThreadRead(thread.id, userId) : markThreadUnread(thread.id, userId),
      ),
  });

  return (
    <AppShell
      userId={userId}
      rail={
        <RailCard title="Inbox">
          <EmptyNote>
            Chats update live. Messages from people you are not connected to wait in Requests until you
            accept them.
          </EmptyNote>
        </RailCard>
      }
    >
      <h1 className="font-display text-xl font-semibold">Messages</h1>

      <div className="mt-4 grid gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
        <InboxPanel
          threads={list}
          myId={userId}
          activeId={activeId}
          loading={inbox.isLoading}
          isOnline={presence.isOnline}
          onOpen={(id) => navigate({ to: ".", search: { thread: id } })}
          actions={rowActions}
          onAcceptRequest={(id) => void run(() => acceptRequest(id, userId))}
          onDeleteRequest={(id) => void run(() => deleteThreadForMe(id, userId))}
        />

        <ChatPanel
          thread={active}
          myId={userId}
          messages={messages.data ?? []}
          loading={messages.isLoading}
          reads={reads.data ?? []}
          typingIds={typingIds}
          isOnline={presence.isOnline}
          lastSeen={presence.lastSeen}
          onSend={(input) => send.mutate(input)}
          onReact={(messageId, emoji) => void run(() => reactToMessage(messageId, userId, emoji))}
          onUnsend={(messageId) => void run(() => unsendMessage(messageId))}
          onTyping={sendTyping}
          onOpenInfo={() => setShowInfo(true)}
        />
      </div>

      {showInfo && active && (
        <GroupInfoPanel
          thread={active}
          myId={userId}
          friends={(friends.data ?? []).map((f) => ({
            id: f.id,
            display_name: f.display_name,
            avatar_url: f.avatar_url,
          }))}
          onClose={() => setShowInfo(false)}
          onRename={(title) => void run(() => updateThreadInfo(active.id, { title: title || null }))}
          onPhoto={(file) =>
            void run(async () => {
              const uploaded = await uploadMedia(file, userId);
              await updateThreadInfo(active.id, { photo_url: uploaded.url });
            })
          }
          onAdd={(memberId) => void run(() => addThreadMembers(active.id, [memberId]))}
          onRemove={(memberId) => void run(() => removeThreadMember(active.id, memberId))}
          onMute={() => void run(() => setThreadMuted(active.id, userId, !active.muted))}
        />
      )}
    </AppShell>
  );
}
