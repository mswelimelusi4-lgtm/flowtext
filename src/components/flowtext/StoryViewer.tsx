import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Eye, Trash2, X } from "lucide-react";
import { UserAvatar } from "./UserAvatar";
import {
  deleteStory,
  markStoryViewed,
  storyTimeLabel,
  storyViewers,
  type StoryGroup,
} from "@/lib/stories";
import { cn } from "@/lib/utils";

export function StoryViewer({
  groups,
  startIndex,
  startStoryIndex = 0,
  userId,
  onClose,
}: {
  groups: StoryGroup[];
  startIndex: number;
  startStoryIndex?: number;
  userId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [groupIndex, setGroupIndex] = useState(startIndex);
  const [storyIndex, setStoryIndex] = useState(startStoryIndex);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showViewers, setShowViewers] = useState(false);
  const touchStart = useRef<number | null>(null);

  const group = groups[groupIndex];
  const story = group?.stories[storyIndex];
  const isMine = group?.author.id === userId;

  const next = useCallback(() => {
    setProgress(0);
    setShowViewers(false);
    if (!group) return onClose();
    if (storyIndex + 1 < group.stories.length) return setStoryIndex(storyIndex + 1);
    if (groupIndex + 1 < groups.length) {
      const nextGroup = groups[groupIndex + 1]!;
      setGroupIndex(groupIndex + 1);
      setStoryIndex(Math.min(nextGroup.firstUnseen, Math.max(0, nextGroup.stories.length - 1)));
      return;
    }
    onClose();
  }, [group, groupIndex, groups, onClose, storyIndex]);


  const previous = useCallback(() => {
    setProgress(0);
    setShowViewers(false);
    if (storyIndex > 0) return setStoryIndex(storyIndex - 1);
    if (groupIndex > 0) {
      const previousGroup = groups[groupIndex - 1]!;
      setGroupIndex(groupIndex - 1);
      setStoryIndex(Math.max(0, previousGroup.stories.length - 1));
    }
  }, [groupIndex, groups, storyIndex]);

  // record the view
  useEffect(() => {
    if (!story || isMine) return;
    void markStoryViewed(story.id, userId).then(() => {
      queryClient.invalidateQueries({ queryKey: ["story-tray", userId] });
    });
  }, [isMine, queryClient, story, userId]);

  // auto-advance timer
  useEffect(() => {
    if (!story || paused || showViewers) return;
    const total = story.duration_ms;
    const step = 50;
    const timer = window.setInterval(() => {
      setProgress((value) => {
        const nextValue = value + (step / total) * 100;
        if (nextValue >= 100) {
          window.clearInterval(timer);
          next();
          return 100;
        }
        return nextValue;
      });
    }, step);
    return () => window.clearInterval(timer);
  }, [next, paused, showViewers, story]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") next();
      if (event.key === "ArrowLeft") previous();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [next, onClose, previous]);

  const viewers = useQuery({
    queryKey: ["story-viewers", story?.id],
    queryFn: () => storyViewers(story!.id),
    enabled: showViewers && !!story && isMine,
  });

  const remove = useMutation({
    mutationFn: () => deleteStory(story!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["story-tray", userId] });
      toast.success("Story deleted");
      next();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!group || !story) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-black/95 text-bone"
      onTouchStart={(event) => (touchStart.current = event.touches[0]?.clientY ?? null)}
      onTouchEnd={(event) => {
        const start = touchStart.current;
        const end = event.changedTouches[0]?.clientY ?? null;
        touchStart.current = null;
        if (start !== null && end !== null && end - start > 90) onClose();
      }}
    >
      {/* progress segments */}
      <div className="flex gap-1 px-3 pt-3">
        {group.stories.map((item, index) => (
          <div key={item.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-bone/25">
            <div
              className="h-full bg-bone"
              style={{
                width: index < storyIndex ? "100%" : index === storyIndex ? `${progress}%` : "0%",
              }}
            />
          </div>
        ))}
      </div>

      {/* header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <Link to="/profile/$userId" params={{ userId: group.author.id }} onClick={onClose}>
          <UserAvatar name={group.author.display_name} src={group.author.avatar_url} className="size-8" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="font-display truncate text-xs font-semibold">{group.author.display_name}</p>
          <p className="text-[10px] opacity-70">{storyTimeLabel(story.created_at)}</p>
        </div>
        {isMine && (
          <>
            <button
              onClick={() => setShowViewers((value) => !value)}
              className="flex items-center gap-1 rounded-full bg-bone/10 px-2.5 py-1 text-[11px]"
            >
              <Eye className="size-3.5" /> Viewers
            </button>
            <button
              onClick={() => remove.mutate()}
              aria-label="Delete story"
              className="rounded-full bg-bone/10 p-1.5"
            >
              <Trash2 className="size-3.5" />
            </button>
          </>
        )}
        <button onClick={onClose} aria-label="Close stories" className="rounded-full bg-bone/10 p-1.5">
          <X className="size-4" />
        </button>
      </div>

      {/* stage */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center p-2">
        <div
          className="relative aspect-[9/16] max-h-full w-full max-w-sm overflow-hidden rounded-3xl"
          style={{ background: story.background }}
          onPointerDown={() => setPaused(true)}
          onPointerUp={() => setPaused(false)}
          onPointerLeave={() => setPaused(false)}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {story.kind === "photo" && story.media_url && (
            <img src={story.media_url} alt="" className="absolute inset-0 size-full object-cover" />
          )}
          {story.kind === "video" && story.media_url && (
            <video
              key={story.id}
              src={story.media_url}
              className="absolute inset-0 size-full object-cover"
              autoPlay
              playsInline
              muted={false}
              onEnded={next}
            />
          )}
          {story.drawing && (
            <img src={story.drawing} alt="" className="pointer-events-none absolute inset-0 size-full object-cover" />
          )}

          {story.caption && (
            <p
              className="font-display absolute inset-x-6 top-1/2 -translate-y-1/2 text-center text-lg leading-snug font-semibold break-words"
              style={{ color: story.text_color }}
            >
              {story.caption}
            </p>
          )}

          {story.overlays.map((item) => (
            <span
              key={item.id}
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 font-semibold"
              style={{
                left: `${item.x}%`,
                top: `${item.y}%`,
                color: item.kind === "text" ? (item.color ?? "#fff") : undefined,
                fontSize: item.size ?? 22,
              }}
            >
              {item.value}
            </span>
          ))}

          {/* tap zones */}
          <button
            onClick={previous}
            aria-label="Previous story"
            className="absolute inset-y-0 left-0 w-1/3 cursor-w-resize"
          />
          <button
            onClick={next}
            aria-label="Next story"
            className="absolute inset-y-0 right-0 w-2/3 cursor-e-resize"
          />

          {paused && (
            <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-2 py-0.5 text-[10px]">
              Paused
            </span>
          )}
        </div>

        <button
          onClick={previous}
          aria-label="Previous"
          className="absolute left-2 hidden rounded-full bg-bone/10 p-2 sm:block"
        >
          <ChevronLeft className="size-4" />
        </button>
        <button
          onClick={next}
          aria-label="Next"
          className="absolute right-2 hidden rounded-full bg-bone/10 p-2 sm:block"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {showViewers && isMine && (
        <div className="max-h-56 overflow-y-auto border-t border-bone/10 p-3">
          <p className="font-display pb-2 text-xs font-semibold">
            Seen by {viewers.data?.length ?? 0}
          </p>
          {(viewers.data ?? []).length === 0 && (
            <p className="text-[11px] opacity-70">No one has seen this story yet.</p>
          )}
          <ul className="space-y-2">
            {(viewers.data ?? []).map((view) => (
              <li key={view.user_id} className="flex items-center gap-2">
                <UserAvatar
                  name={view.viewer?.display_name ?? "FlowText member"}
                  src={view.viewer?.avatar_url ?? null}
                  className="size-7"
                />
                <span className="truncate text-xs">{view.viewer?.display_name ?? "FlowText member"}</span>
                <span className={cn("ml-auto text-[10px] opacity-60")}>
                  {storyTimeLabel(view.created_at)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
