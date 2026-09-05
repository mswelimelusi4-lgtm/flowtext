import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Brush, Eraser, Image as ImageIcon, Smile, Type, X } from "lucide-react";
import { uploadMedia } from "@/lib/media";
import { UserAvatar } from "./UserAvatar";
import {
  STORY_BACKGROUNDS,
  STORY_STICKERS,
  STORY_TEXT_COLORS,
  createStory,
  fetchFriendChoices,
  type StoryOverlay,
  type StoryVisibility,
} from "@/lib/stories";
import { cn } from "@/lib/utils";

type Audience = StoryVisibility | "custom";

export function StoryComposer({ userId, onClose }: { userId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement | null>(null);
  const stage = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [videoMs, setVideoMs] = useState(5000);
  const [background, setBackground] = useState(STORY_BACKGROUNDS[0]!);
  const [textColor, setTextColor] = useState(STORY_TEXT_COLORS[0]!);
  const [caption, setCaption] = useState("");
  const [overlays, setOverlays] = useState<StoryOverlay[]>([]);
  const [tool, setTool] = useState<"none" | "pen">("none");
  const [showStickers, setShowStickers] = useState(false);
  const [audience, setAudience] = useState<Audience>("friends");
  const [excluded, setExcluded] = useState<string[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);

  const friends = useQuery({
    queryKey: ["story-friend-choices", userId],
    queryFn: () => fetchFriendChoices(userId),
  });

  function pickFile(picked: File | undefined) {
    if (!picked) return;
    setFile(picked);
    setPreview(URL.createObjectURL(picked));
    setIsVideo(picked.type.startsWith("video/"));
  }

  function stagePoint(event: React.PointerEvent) {
    const box = stage.current?.getBoundingClientRect();
    if (!box) return { x: 50, y: 50 };
    return {
      x: ((event.clientX - box.left) / box.width) * 100,
      y: ((event.clientY - box.top) / box.height) * 100,
    };
  }

  function addText() {
    const value = window.prompt("Add text to your story");
    if (!value?.trim()) return;
    setOverlays((list) => [
      ...list,
      {
        id: crypto.randomUUID(),
        kind: "text",
        value: value.trim(),
        x: 50,
        y: 40,
        color: textColor,
        size: 22,
      },
    ]);
  }

  function addSticker(glyph: string) {
    setOverlays((list) => [
      ...list,
      { id: crypto.randomUUID(), kind: "sticker", value: glyph, x: 50, y: 60, size: 40 },
    ]);
    setShowStickers(false);
  }

  // ---- pen tool ----
  function penDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (tool !== "pen") return;
    const element = canvas.current;
    if (!element) return;
    element.width = element.clientWidth;
    if (element.height !== element.clientHeight) {
      const snapshot = element.toDataURL();
      element.height = element.clientHeight;
      const image = new Image();
      image.onload = () => element.getContext("2d")?.drawImage(image, 0, 0);
      image.src = snapshot;
    }
    drawing.current = true;
    const ctx = element.getContext("2d");
    if (!ctx) return;
    const box = element.getBoundingClientRect();
    ctx.strokeStyle = textColor;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(event.clientX - box.left, event.clientY - box.top);
  }

  function penMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const element = canvas.current;
    const ctx = element?.getContext("2d");
    if (!element || !ctx) return;
    const box = element.getBoundingClientRect();
    ctx.lineTo(event.clientX - box.left, event.clientY - box.top);
    ctx.stroke();
  }

  function clearDrawing() {
    const element = canvas.current;
    const ctx = element?.getContext("2d");
    if (element && ctx) ctx.clearRect(0, 0, element.width, element.height);
  }

  const share = useMutation({
    mutationFn: async () => {
      if (!file && !caption.trim() && overlays.length === 0) {
        throw new Error("Add a photo, a video or some text first");
      }

      let mediaUrl: string | null = null;
      if (file) mediaUrl = (await uploadMedia(file, userId)).url;

      let drawingUrl: string | null = null;
      const element = canvas.current;
      if (element && element.width > 0) {
        const blob = await new Promise<Blob | null>((resolve) => element.toBlob(resolve, "image/png"));
        const empty = await isBlank(element);
        if (blob && !empty) {
          const drawFile = new File([blob], "drawing.png", { type: "image/png" });
          drawingUrl = (await uploadMedia(drawFile, userId)).url;
        }
      }

      return createStory({
        authorId: userId,
        kind: file ? (isVideo ? "video" : "photo") : "text",
        mediaUrl,
        caption: caption.trim() || null,
        background,
        textColor,
        overlays,
        drawing: drawingUrl,
        durationMs: isVideo ? Math.max(2000, Math.min(60000, videoMs)) : 5000,
        visibility: audience === "public" ? "public" : "friends",
        excludeIds: audience === "custom" ? excluded : [],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["story-tray", userId] });
      toast.success("Shared to your story");
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-ink/95 p-3 text-bone backdrop-blur-sm sm:p-6">
      <div className="mx-auto flex w-full max-w-md items-center justify-between pb-3">
        <h2 className="font-display text-sm font-semibold">Create a story</h2>
        <button onClick={onClose} aria-label="Close story creation" className="rounded-full bg-bone/10 p-1.5">
          <X className="size-4" />
        </button>
      </div>

      <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col gap-3 overflow-y-auto pb-4">
        {/* stage */}
        <div
          ref={stage}
          className="relative aspect-[9/16] w-full shrink-0 overflow-hidden rounded-3xl"
          style={{ background }}
          onPointerMove={(event) => {
            if (!dragId) return;
            const point = stagePoint(event);
            setOverlays((list) =>
              list.map((item) => (item.id === dragId ? { ...item, ...point } : item)),
            );
          }}
          onPointerUp={() => setDragId(null)}
        >
          {preview && !isVideo && (
            <img src={preview} alt="Story preview" className="absolute inset-0 size-full object-cover" />
          )}
          {preview && isVideo && (
            <video
              src={preview}
              className="absolute inset-0 size-full object-cover"
              muted
              playsInline
              autoPlay
              loop
              onLoadedMetadata={(event) =>
                setVideoMs(Math.round((event.currentTarget.duration || 5) * 1000))
              }
            />
          )}

          {!preview && caption.trim() === "" && overlays.length === 0 && (
            <p className="absolute inset-0 grid place-items-center px-8 text-center text-xs opacity-70">
              Pick a photo or video, or just type — your words become the story.
            </p>
          )}

          {caption.trim() !== "" && (
            <p
              className="font-display absolute inset-x-6 top-1/2 -translate-y-1/2 text-center text-lg leading-snug font-semibold break-words"
              style={{ color: textColor }}
            >
              {caption}
            </p>
          )}

          {overlays.map((item) => (
            <button
              key={item.id}
              onPointerDown={() => setDragId(item.id)}
              onDoubleClick={() => setOverlays((list) => list.filter((x) => x.id !== item.id))}
              className="absolute -translate-x-1/2 -translate-y-1/2 cursor-move select-none font-semibold"
              style={{
                left: `${item.x}%`,
                top: `${item.y}%`,
                color: item.kind === "text" ? (item.color ?? "#fff") : undefined,
                fontSize: item.size ?? 22,
              }}
              title="Drag to move, double tap to remove"
            >
              {item.value}
            </button>
          ))}

          <canvas
            ref={canvas}
            onPointerDown={penDown}
            onPointerMove={penMove}
            onPointerUp={() => (drawing.current = false)}
            onPointerLeave={() => (drawing.current = false)}
            className={cn(
              "absolute inset-0 size-full touch-none",
              tool === "pen" ? "cursor-crosshair" : "pointer-events-none",
            )}
          />
        </div>

        {/* tools */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInput}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={(event) => pickFile(event.target.files?.[0])}
          />
          <ToolButton onClick={() => fileInput.current?.click()} icon={<ImageIcon className="size-4" />} label="Photo / video" />
          <ToolButton onClick={addText} icon={<Type className="size-4" />} label="Text" />
          <ToolButton onClick={() => setShowStickers((value) => !value)} icon={<Smile className="size-4" />} label="Stickers" />
          <ToolButton
            onClick={() => setTool((value) => (value === "pen" ? "none" : "pen"))}
            icon={<Brush className="size-4" />}
            label={tool === "pen" ? "Drawing on" : "Draw"}
            active={tool === "pen"}
          />
          <ToolButton onClick={clearDrawing} icon={<Eraser className="size-4" />} label="Clear pen" />
        </div>

        {showStickers && (
          <div className="grid max-h-32 grid-cols-8 gap-1 overflow-y-auto rounded-2xl bg-bone/10 p-2">
            {STORY_STICKERS.map((glyph) => (
              <button key={glyph} onClick={() => addSticker(glyph)} className="text-xl">
                {glyph}
              </button>
            ))}
          </div>
        )}

        <textarea
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          placeholder="Say something…"
          rows={2}
          data-osk-submit="story-share-button"
          data-osk-action="Share"
          className="w-full resize-none rounded-2xl bg-bone/10 p-3 text-sm text-bone placeholder:text-bone/50 focus:outline-none"
        />


        <div>
          <p className="text-[11px] font-semibold opacity-70">Background</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {STORY_BACKGROUNDS.map((color) => (
              <button
                key={color}
                onClick={() => setBackground(color)}
                aria-label={`Background ${color}`}
                className={cn("size-7 rounded-full ring-2", background === color ? "ring-bone" : "ring-transparent")}
                style={{ background: color }}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold opacity-70">Text colour</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {STORY_TEXT_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => setTextColor(color)}
                aria-label={`Text colour ${color}`}
                className={cn("size-7 rounded-full ring-2", textColor === color ? "ring-bone" : "ring-transparent")}
                style={{ background: color }}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold opacity-70">Who can see this</p>
          <div className="mt-1.5 flex gap-2">
            {(
              [
                { value: "public", label: "Public" },
                { value: "friends", label: "Friends" },
                { value: "custom", label: "Friends except…" },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                onClick={() => setAudience(option.value)}
                className={cn(
                  "font-display rounded-full px-3 py-1 text-[11px] font-semibold",
                  audience === option.value ? "bg-bone text-ink" : "bg-bone/10 text-bone",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          {audience === "custom" && (
            <div className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-2xl bg-bone/10 p-2">
              {(friends.data ?? []).length === 0 && (
                <p className="p-1 text-[11px] opacity-70">No friends to hide this from yet.</p>
              )}
              {(friends.data ?? []).map((friend) => {
                const hidden = excluded.includes(friend.id);
                return (
                  <button
                    key={friend.id}
                    onClick={() =>
                      setExcluded((list) =>
                        hidden ? list.filter((id) => id !== friend.id) : [...list, friend.id],
                      )
                    }
                    className="flex w-full items-center gap-2 rounded-xl px-1.5 py-1 text-left hover:bg-bone/10"
                  >
                    <UserAvatar name={friend.display_name} src={friend.avatar_url} className="size-7" />
                    <span className="flex-1 truncate text-xs">{friend.display_name}</span>
                    <span className={cn("text-[10px] font-semibold", hidden ? "text-clay" : "opacity-60")}>
                      {hidden ? "Hidden" : "Can see"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div
        className="mx-auto w-full max-w-md pt-2"
        style={{ paddingBottom: "var(--osk-height, 0px)" }}
      >
        <button
          id="story-share-button"
          onClick={() => share.mutate()}
          disabled={share.isPending}
          className="font-display w-full rounded-full bg-bone py-3 text-sm font-semibold text-ink disabled:opacity-60"
        >
          {share.isPending ? "Sharing…" : "Share to Story"}
        </button>
      </div>

    </div>
  );
}

function ToolButton({
  onClick,
  icon,
  label,
  active,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "font-display flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold",
        active ? "bg-bone text-ink" : "bg-bone/10 text-bone",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

async function isBlank(element: HTMLCanvasElement) {
  const ctx = element.getContext("2d");
  if (!ctx || element.width === 0 || element.height === 0) return true;
  const { data } = ctx.getImageData(0, 0, element.width, element.height);
  for (let index = 3; index < data.length; index += 4) {
    if (data[index] !== 0) return false;
  }
  return true;
}
