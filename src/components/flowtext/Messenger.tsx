import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  BellOff,
  Check,
  Image as ImageIcon,
  Info,
  Mic,
  MoreHorizontal,
  Phone,
  Reply,
  Search,
  Send,
  Smile,
  Sticker,
  ThumbsUp,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/flowtext/UserAvatar";
import { uploadMedia } from "@/lib/media";
import {
  MESSAGE_EMOJI,
  activeLabel,
  shortTime,
  threadTitle,
  type ChatMessage,
  type InboxThread,
  type ParticipantRead,
  type ProfileLite,
} from "@/lib/messaging";
import { cn } from "@/lib/utils";

const GIFS = [
  "https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif",
  "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif",
  "https://media.giphy.com/media/xT0GqssRweIhlz209i/giphy.gif",
  "https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif",
];
const STICKERS = ["🎉", "🐣", "🌈", "🍕", "🚀", "🧋", "🎧", "🌻", "💤", "🪩", "🐳", "🔥"];
const EMOJI_PICKER = [
  "😀","😂","🥲","😍","😎","🤔","😭","😡","🥳","😴","🤗","🙌","👍","👏","🙏","💪","❤️","🔥","✨","🎉",
];

/* =================== inbox =================== */

function StackedAvatars({ people }: { people: ProfileLite[] }) {
  const shown = people.slice(0, 2);
  if (shown.length < 2) {
    const first = shown[0];
    return <UserAvatar name={first?.display_name ?? "Chat"} src={first?.avatar_url} className="size-12" />;
  }
  return (
    <span className="relative block size-12 shrink-0">
      <UserAvatar
        name={shown[0]!.display_name}
        src={shown[0]!.avatar_url}
        className="absolute left-0 top-0 size-8 ring-2 ring-card"
      />
      <UserAvatar
        name={shown[1]!.display_name}
        src={shown[1]!.avatar_url}
        className="absolute bottom-0 right-0 size-8 ring-2 ring-card"
      />
    </span>
  );
}

type RowActions = {
  onMute: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onToggleRead: () => void;
};

function ConversationRow({
  thread,
  myId,
  active,
  online,
  onOpen,
  actions,
}: {
  thread: InboxThread;
  myId: string;
  active: boolean;
  online: boolean;
  onOpen: () => void;
  actions: RowActions;
}) {
  const [offset, setOffset] = useState(0);
  const [menu, setMenu] = useState(false);
  const startX = useRef<number | null>(null);
  const press = useRef<number | null>(null);

  const unread = thread.unread > 0;
  const other = thread.participants[0];
  const preview = thread.lastMessage
    ? thread.lastMessage.deleted
      ? thread.lastMessage.sender_id === myId
        ? "You removed a message"
        : "Message removed"
      : `${thread.lastMessage.sender_id === myId ? "You: " : ""}${
          thread.lastMessage.kind === "audio"
            ? "Voice message"
            : thread.lastMessage.kind === "image"
              ? "Photo"
              : thread.lastMessage.content
        }`
    : "Say hi 👋";

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <div className="absolute inset-y-0 right-0 flex items-stretch">
        <button onClick={actions.onMute} className="flex w-16 flex-col items-center justify-center gap-1 bg-bone-deep text-[0.6rem] text-ink-soft">
          <BellOff className="size-4" /> {thread.muted ? "Unmute" : "Mute"}
        </button>
        <button onClick={actions.onArchive} className="flex w-16 flex-col items-center justify-center gap-1 bg-amber/70 text-[0.6rem] text-ink">
          <Archive className="size-4" /> {thread.archived ? "Unarchive" : "Archive"}
        </button>
        <button onClick={actions.onDelete} className="flex w-16 flex-col items-center justify-center gap-1 bg-destructive text-[0.6rem] text-destructive-foreground">
          <Trash2 className="size-4" /> Delete
        </button>
      </div>

      <button
        type="button"
        onClick={() => {
          if (offset !== 0) {
            setOffset(0);
            return;
          }
          onOpen();
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          setMenu(true);
        }}
        onTouchStart={(event) => {
          startX.current = event.touches[0]?.clientX ?? null;
          press.current = window.setTimeout(() => setMenu(true), 500);
        }}
        onTouchMove={(event) => {
          if (press.current) window.clearTimeout(press.current);
          const x = event.touches[0]?.clientX ?? 0;
          if (startX.current === null) return;
          const delta = x - startX.current;
          setOffset(Math.max(-192, Math.min(0, delta)));
        }}
        onTouchEnd={() => {
          if (press.current) window.clearTimeout(press.current);
          setOffset((current) => (current < -60 ? -192 : 0));
          startX.current = null;
        }}
        style={{ transform: `translateX(${offset}px)` }}
        className={cn(
          "relative flex w-full items-center gap-3 p-3 text-left transition-transform duration-200",
          active ? "bg-ink text-bone" : "bg-card hover:bg-bone-soft",
        )}
      >
        <span className="relative">
          {thread.is_group ? (
            <StackedAvatars people={thread.participants} />
          ) : (
            <UserAvatar name={other?.display_name ?? "Chat"} src={other?.avatar_url} className="size-12" />
          )}
          {!thread.is_group && online && (
            <span className="absolute bottom-0 right-0 size-3.5 rounded-full bg-emerald-500 ring-2 ring-card" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn("font-display block truncate text-sm", unread ? "font-bold" : "font-medium")}>
            {threadTitle(thread, myId)}
            {thread.muted && <BellOff className="ml-1 inline size-3 opacity-60" />}
          </span>
          <span className={cn("block truncate text-xs", unread ? "font-semibold" : "opacity-70")}>
            {preview}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1 text-[0.65rem] opacity-70">
          {shortTime(thread.last_message_at)}
          {unread && <span className="size-2.5 rounded-full bg-teal-deep" />}
        </span>
      </button>

      {menu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
          <div className="absolute right-3 top-3 z-50 w-48 overflow-hidden rounded-xl bg-card text-xs shadow-lg ring-1 ring-black/10">
            {[
              { label: thread.unread > 0 ? "Mark as Read" : "Mark as Unread", run: actions.onToggleRead },
              { label: thread.muted ? "Unmute Notifications" : "Mute Notifications", run: actions.onMute },
              { label: thread.archived ? "Unarchive Chat" : "Archive Chat", run: actions.onArchive },
              { label: "Delete Chat", run: actions.onDelete },
            ].map((item) => (
              <button
                key={item.label}
                onClick={() => {
                  setMenu(false);
                  item.run();
                }}
                className="block w-full px-3 py-2 text-left hover:bg-bone-soft"
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function InboxPanel({
  threads,
  myId,
  activeId,
  loading,
  isOnline,
  onOpen,
  actions,
  onAcceptRequest,
  onDeleteRequest,
}: {
  threads: InboxThread[];
  myId: string;
  activeId: string | undefined;
  loading: boolean;
  isOnline: (id: string) => boolean;
  onOpen: (id: string) => void;
  actions: (thread: InboxThread) => RowActions;
  onAcceptRequest: (id: string) => void;
  onDeleteRequest: (id: string) => void;
}) {
  const [tab, setTab] = useState<"chats" | "requests">("chats");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return threads.filter((thread) => {
      const inTab = tab === "requests" ? thread.state === "pending" : thread.state === "accepted";
      if (!inTab) return false;
      if (!term) return true;
      return threadTitle(thread, myId).toLowerCase().includes(term);
    });
  }, [threads, tab, query, myId]);

  const requestCount = threads.filter((t) => t.state === "pending").length;

  return (
    <aside className="flex flex-col gap-3">
      <label className="flex items-center gap-2 rounded-full bg-bone-soft px-3 py-2 ring-1 ring-black/5">
        <Search className="size-4 text-ink-soft" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search conversations"
          className="w-full bg-transparent text-sm outline-none placeholder:text-ink-soft"
        />
      </label>

      <div className="flex gap-2">
        {(["chats", "requests"] as const).map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "font-display flex-1 rounded-full px-3 py-1.5 text-xs font-semibold capitalize ring-1 ring-black/5",
              tab === key ? "bg-ink text-bone" : "bg-card text-ink-soft hover:bg-bone-soft",
            )}
          >
            {key}
            {key === "requests" && requestCount > 0 && ` (${requestCount})`}
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        {loading && [0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-bone-soft" />)}
        {!loading && filtered.length === 0 && (
          <p className="rounded-2xl bg-bone-soft/60 p-4 text-xs text-ink-soft ring-1 ring-black/5">
            {tab === "requests" ? "No message requests." : "No conversations yet."}
          </p>
        )}
        {filtered.map((thread) =>
          tab === "requests" ? (
            <div key={thread.id} className="rounded-2xl bg-card p-3 ring-1 ring-black/5">
              <button onClick={() => onOpen(thread.id)} className="flex w-full items-center gap-3 text-left">
                <UserAvatar
                  name={thread.participants[0]?.display_name ?? "Someone"}
                  src={thread.participants[0]?.avatar_url}
                  className="size-11"
                />
                <span className="min-w-0">
                  <span className="font-display block truncate text-sm font-semibold">
                    {threadTitle(thread, myId)}
                  </span>
                  <span className="block truncate text-xs text-ink-soft">
                    {thread.lastMessage?.content ?? "Wants to send you a message"}
                  </span>
                </span>
              </button>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => onAcceptRequest(thread.id)}
                  className="font-display flex-1 rounded-full bg-teal-deep px-3 py-1.5 text-xs font-semibold text-bone"
                >
                  Accept
                </button>
                <button
                  onClick={() => onDeleteRequest(thread.id)}
                  className="font-display flex-1 rounded-full bg-bone-soft px-3 py-1.5 text-xs font-semibold text-ink-soft"
                >
                  Delete
                </button>
              </div>
            </div>
          ) : (
            <ConversationRow
              key={thread.id}
              thread={thread}
              myId={myId}
              active={thread.id === activeId}
              online={thread.participants.some((p) => isOnline(p.id))}
              onOpen={() => onOpen(thread.id)}
              actions={actions(thread)}
            />
          ),
        )}
      </div>
    </aside>
  );
}

/* =================== conversation =================== */

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-bone-soft px-3 py-2">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 animate-bounce rounded-full bg-ink-soft"
          style={{ animationDelay: `${i * 120}ms` }}
        />
      ))}
    </span>
  );
}

function Bubble({
  message,
  mine,
  showAvatar,
  seenBy,
  onReact,
  onReply,
  onUnsend,
  myId,
}: {
  message: ChatMessage;
  mine: boolean;
  showAvatar: boolean;
  seenBy: ProfileLite[];
  onReact: (emoji: string) => void;
  onReply: () => void;
  onUnsend: () => void;
  myId: string;
}) {
  const [showTime, setShowTime] = useState(false);
  const [tools, setTools] = useState(false);
  const press = useRef<number | null>(null);
  const removed = Boolean(message.deleted_at);

  const reactionSummary = useMemo(() => {
    const counts = new Map<string, number>();
    message.reactions.forEach((r) => counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1));
    return [...counts.entries()];
  }, [message.reactions]);

  return (
    <div className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
      <div
        className={cn("group relative flex max-w-[85%] items-end gap-2", mine && "flex-row-reverse")}
        onMouseEnter={() => setTools(true)}
        onMouseLeave={() => setTools(false)}
        onTouchStart={() => {
          press.current = window.setTimeout(() => setTools(true), 450);
        }}
        onTouchEnd={() => {
          if (press.current) window.clearTimeout(press.current);
        }}
      >
        {!mine && (
          <span className="w-7 shrink-0">
            {showAvatar && (
              <UserAvatar
                name={message.sender?.display_name ?? "?"}
                src={message.sender?.avatar_url}
                className="size-7"
              />
            )}
          </span>
        )}

        <button
          type="button"
          onClick={() => setShowTime((v) => !v)}
          className={cn(
            "rounded-2xl px-3 py-2 text-left text-sm",
            removed
              ? "bg-bone-soft italic text-ink-soft"
              : mine
                ? "bg-teal-deep text-bone"
                : "bg-bone-deep text-ink",
          )}
        >
          {message.replyTo && !removed && (
            <span className="mb-1 block truncate rounded-lg bg-black/10 px-2 py-1 text-[0.7rem] opacity-80">
              {message.replyTo.deleted_at ? "Removed message" : message.replyTo.content}
            </span>
          )}
          {removed ? (
            mine ? "You removed a message" : "Message removed"
          ) : message.kind === "audio" && message.media_url ? (
            <audio controls src={message.media_url} className="max-w-52" />
          ) : message.kind === "image" && message.media_url ? (
            <img src={message.media_url} alt="Attachment" className="max-h-64 rounded-xl" />
          ) : (
            <span className="whitespace-pre-wrap break-words">{message.content}</span>
          )}
        </button>

        {tools && !removed && (
          <div className="absolute -top-9 z-20 flex items-center gap-0.5 rounded-full bg-card px-1.5 py-1 shadow-md ring-1 ring-black/10"
            style={mine ? { right: 0 } : { left: 28 }}
          >
            {MESSAGE_EMOJI.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  onReact(emoji);
                  setTools(false);
                }}
                className="rounded-full px-1 text-sm hover:bg-bone-soft"
              >
                {emoji}
              </button>
            ))}
            <button onClick={onReply} className="rounded-full p-1 hover:bg-bone-soft" aria-label="Reply">
              <Reply className="size-3.5" />
            </button>
            {mine && (
              <button onClick={onUnsend} className="rounded-full p-1 hover:bg-bone-soft" aria-label="Unsend">
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {reactionSummary.length > 0 && (
        <span className="-mt-1.5 flex gap-1 rounded-full bg-card px-1.5 py-0.5 text-[0.7rem] shadow-sm ring-1 ring-black/10">
          {reactionSummary.map(([emoji, count]) => (
            <span key={emoji}>
              {emoji}
              {count > 1 && <span className="ml-0.5 text-ink-soft">{count}</span>}
            </span>
          ))}
        </span>
      )}

      {showTime && (
        <span className="mt-0.5 text-[0.65rem] text-ink-soft">
          {new Date(message.created_at).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </span>
      )}

      {mine && seenBy.length > 0 && (
        <span className="mt-1 flex gap-1">
          {seenBy.map((person) => (
            <UserAvatar
              key={person.id + myId}
              name={person.display_name}
              src={person.avatar_url}
              className="size-4"
            />
          ))}
        </span>
      )}
    </div>
  );
}

export function ChatPanel({
  thread,
  myId,
  messages,
  loading,
  reads,
  typingIds,
  isOnline,
  lastSeen,
  onSend,
  onReact,
  onUnsend,
  onTyping,
  onOpenInfo,
}: {
  thread: InboxThread | undefined;
  myId: string;
  messages: ChatMessage[];
  loading: boolean;
  reads: ParticipantRead[];
  typingIds: string[];
  isOnline: (id: string) => boolean;
  lastSeen: (id: string) => number | null;
  onSend: (input: { content: string; mediaUrl?: string | null; kind?: string; replyToId?: string | null }) => void;
  onReact: (messageId: string, emoji: string) => void;
  onUnsend: (messageId: string) => void;
  onTyping: () => void;
  onOpenInfo: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [tray, setTray] = useState<"none" | "emoji" | "gif" | "sticker">("none");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [recording, setRecording] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, typingIds.length, thread?.id]);

  if (!thread) {
    return (
      <div className="grid min-h-64 place-items-center rounded-2xl bg-bone-soft/60 p-6 text-sm text-ink-soft ring-1 ring-black/5">
        Pick a conversation to start chatting.
      </div>
    );
  }

  const other = thread.participants[0];
  const online = thread.participants.some((p) => isOnline(p.id));
  const status = thread.is_group
    ? `${thread.members.length} members`
    : activeLabel(other ? lastSeen(other.id) : null, online);

  const myLast = [...messages].reverse().find((m) => m.sender_id === myId);
  const seenBy = myLast
    ? reads
        .filter((r) => r.user_id !== myId && r.last_read_at >= myLast.created_at)
        .map((r) => thread.members.find((m) => m.id === r.user_id))
        .filter((p): p is ProfileLite => Boolean(p))
    : [];

  const submit = (payload: { content: string; kind?: string; mediaUrl?: string | null }) => {
    onSend({ ...payload, replyToId: replyTo?.id ?? null });
    setReplyTo(null);
    setTray("none");
  };

  const attach = async (file: File) => {
    try {
      const uploaded = await uploadMedia(file, myId);
      submit({ content: "", kind: uploaded.kind === "image" ? "image" : "video", mediaUrl: uploaded.url });
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const toggleRecording = async () => {
    if (recording) {
      recorder.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (event) => chunks.push(event.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const file = new File(chunks, "voice.webm", { type: "audio/webm" });
        try {
          const uploaded = await uploadMedia(file, myId);
          submit({ content: "", kind: "audio", mediaUrl: uploaded.url });
        } catch (error) {
          toast.error((error as Error).message);
        }
      };
      recorder.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      toast.error("Microphone access was blocked.");
    }
  };

  return (
    <section className="flex min-h-[60vh] flex-col rounded-2xl bg-card ring-1 ring-black/5">
      <header className="flex items-center gap-3 border-b border-black/5 p-3">
        <button onClick={onOpenInfo} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className="relative">
            {thread.is_group ? (
              <StackedAvatars people={thread.participants} />
            ) : (
              <UserAvatar name={other?.display_name ?? "Chat"} src={other?.avatar_url} className="size-10" />
            )}
            {online && !thread.is_group && (
              <span className="absolute bottom-0 right-0 size-3 rounded-full bg-emerald-500 ring-2 ring-card" />
            )}
          </span>
          <span className="min-w-0">
            <span className="font-display block truncate text-sm font-semibold">
              {threadTitle(thread, myId)}
            </span>
            <span className="block truncate text-[0.7rem] text-ink-soft">{status}</span>
          </span>
        </button>
        <button onClick={() => toast("Voice calls are coming soon.")} aria-label="Voice call" className="rounded-full p-2 hover:bg-bone-soft">
          <Phone className="size-4" />
        </button>
        <button onClick={() => toast("Video calls are coming soon.")} aria-label="Video call" className="rounded-full p-2 hover:bg-bone-soft">
          <Video className="size-4" />
        </button>
        <button onClick={onOpenInfo} aria-label="Conversation info" className="rounded-full p-2 hover:bg-bone-soft">
          <Info className="size-4" />
        </button>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {loading && <p className="text-xs text-ink-soft">Loading messages…</p>}
        {!loading && messages.length === 0 && (
          <p className="text-xs text-ink-soft">No messages yet — say hello.</p>
        )}
        {messages.map((message, index) => {
          const next = messages[index + 1];
          const lastOfGroup = !next || next.sender_id !== message.sender_id;
          return (
            <Bubble
              key={message.id}
              message={message}
              mine={message.sender_id === myId}
              showAvatar={lastOfGroup}
              seenBy={message.id === myLast?.id ? seenBy : []}
              myId={myId}
              onReact={(emoji) => onReact(message.id, emoji)}
              onReply={() => setReplyTo(message)}
              onUnsend={() => onUnsend(message.id)}
            />
          );
        })}
        {typingIds.length > 0 && <TypingDots />}
        <div ref={endRef} />
      </div>

      {replyTo && (
        <div className="flex items-center gap-2 border-t border-black/5 px-3 py-2 text-xs text-ink-soft">
          <Reply className="size-3.5" />
          <span className="min-w-0 flex-1 truncate">Replying to “{replyTo.content}”</span>
          <button onClick={() => setReplyTo(null)} aria-label="Cancel reply">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {tray !== "none" && (
        <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto border-t border-black/5 p-3">
          {tray === "emoji" &&
            EMOJI_PICKER.map((emoji) => (
              <button key={emoji} onClick={() => setDraft((d) => d + emoji)} className="text-xl">
                {emoji}
              </button>
            ))}
          {tray === "sticker" &&
            STICKERS.map((sticker) => (
              <button key={sticker} onClick={() => submit({ content: sticker })} className="text-2xl">
                {sticker}
              </button>
            ))}
          {tray === "gif" &&
            GIFS.map((url) => (
              <button key={url} onClick={() => submit({ content: "", kind: "image", mediaUrl: url })}>
                <img src={url} alt="GIF" className="h-16 rounded-lg" />
              </button>
            ))}
        </div>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          const text = draft.trim();
          if (!text) return;
          submit({ content: text });
          setDraft("");
        }}
        className="flex items-center gap-1 border-t border-black/5 p-2"
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void attach(file);
            event.target.value = "";
          }}
        />
        <button type="button" onClick={() => fileRef.current?.click()} aria-label="Add photo" className="rounded-full p-2 hover:bg-bone-soft">
          <ImageIcon className="size-4" />
        </button>
        <button type="button" onClick={() => setTray((t) => (t === "gif" ? "none" : "gif"))} aria-label="GIF" className="rounded-full px-2 py-1 text-[0.7rem] font-bold hover:bg-bone-soft">
          GIF
        </button>
        <button type="button" onClick={() => setTray((t) => (t === "sticker" ? "none" : "sticker"))} aria-label="Sticker" className="rounded-full p-2 hover:bg-bone-soft">
          <Sticker className="size-4" />
        </button>
        <input
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            onTyping();
          }}
          placeholder="Aa"
          data-keyboard-action="Send"
          className="min-w-0 flex-1 rounded-full bg-bone-soft px-3 py-2 text-sm outline-none placeholder:text-ink-soft"
        />
        <button type="button" onClick={() => setTray((t) => (t === "emoji" ? "none" : "emoji"))} aria-label="Emoji" className="rounded-full p-2 hover:bg-bone-soft">
          <Smile className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => void toggleRecording()}
          aria-label="Voice message"
          className={cn("rounded-full p-2 hover:bg-bone-soft", recording && "bg-destructive text-destructive-foreground")}
        >
          <Mic className="size-4" />
        </button>
        {draft.trim() ? (
          <button type="submit" aria-label="Send" className="rounded-full bg-teal-deep p-2 text-bone">
            <Send className="size-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => submit({ content: "👍" })}
            aria-label="Send a thumbs up"
            className="rounded-full p-2 text-teal-deep hover:bg-bone-soft"
          >
            <ThumbsUp className="size-4" />
          </button>
        )}
      </form>
    </section>
  );
}

export function GroupInfoPanel({
  thread,
  myId,
  friends,
  onClose,
  onRename,
  onPhoto,
  onAdd,
  onRemove,
  onMute,
}: {
  thread: InboxThread;
  myId: string;
  friends: ProfileLite[];
  onClose: () => void;
  onRename: (title: string) => void;
  onPhoto: (file: File) => void;
  onAdd: (userId: string) => void;
  onRemove: (userId: string) => void;
  onMute: () => void;
}) {
  const [name, setName] = useState(thread.title ?? "");
  const photoRef = useRef<HTMLInputElement | null>(null);
  const candidates = friends.filter((f) => !thread.members.some((m) => m.id === f.id));

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40" onClick={onClose}>
      <div
        className="h-full w-full max-w-sm overflow-y-auto bg-card p-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-semibold">Conversation info</h2>
          <button onClick={onClose} aria-label="Close"><X className="size-4" /></button>
        </div>

        {thread.is_group && (
          <div className="mt-4 space-y-2">
            <label className="block text-xs font-semibold text-ink-soft">Group name</label>
            <div className="flex gap-2">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="min-w-0 flex-1 rounded-xl bg-bone-soft px-3 py-2 text-sm outline-none"
              />
              <button
                onClick={() => onRename(name.trim())}
                className="font-display rounded-xl bg-ink px-3 text-xs font-semibold text-bone"
              >
                <Check className="size-4" />
              </button>
            </div>
            <input
              ref={photoRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onPhoto(file);
                event.target.value = "";
              }}
            />
            <button
              onClick={() => photoRef.current?.click()}
              className="text-xs font-semibold text-teal-deep underline"
            >
              Change group photo
            </button>
          </div>
        )}

        <button
          onClick={onMute}
          className="mt-4 flex w-full items-center gap-2 rounded-xl bg-bone-soft px-3 py-2 text-xs font-semibold"
        >
          <BellOff className="size-4" /> {thread.muted ? "Unmute notifications" : "Mute notifications"}
        </button>

        <h3 className="font-display mt-5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
          Members ({thread.members.length})
        </h3>
        <ul className="mt-2 space-y-1">
          {thread.members.map((member) => (
            <li key={member.id} className="flex items-center gap-2 rounded-xl p-2 hover:bg-bone-soft">
              <UserAvatar name={member.display_name} src={member.avatar_url} className="size-8" />
              <span className="min-w-0 flex-1 truncate text-sm">
                {member.display_name}
                {member.id === myId && <span className="text-ink-soft"> (you)</span>}
              </span>
              {thread.is_group && member.id !== myId && (
                <button onClick={() => onRemove(member.id)} aria-label="Remove member">
                  <MoreHorizontal className="size-4 text-ink-soft" />
                </button>
              )}
            </li>
          ))}
        </ul>

        {thread.is_group && candidates.length > 0 && (
          <>
            <h3 className="font-display mt-5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
              Add people
            </h3>
            <ul className="mt-2 space-y-1">
              {candidates.map((friend) => (
                <li key={friend.id} className="flex items-center gap-2 rounded-xl p-2">
                  <UserAvatar name={friend.display_name} src={friend.avatar_url} className="size-8" />
                  <span className="min-w-0 flex-1 truncate text-sm">{friend.display_name}</span>
                  <button
                    onClick={() => onAdd(friend.id)}
                    className="font-display rounded-full bg-teal-deep px-3 py-1 text-[0.7rem] font-semibold text-bone"
                  >
                    Add
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
