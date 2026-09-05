import { useId, useRef, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createPost, getProfile } from "@/lib/api";
import { uploadMedia } from "@/lib/media";
import { UserAvatar } from "./UserAvatar";
import { cn } from "@/lib/utils";

const VISIBILITY = [
  { value: "public", label: "Public" },
  { value: "friends", label: "Friends-only" },
  { value: "private", label: "Only me" },
] as const;

export function Composer({
  userId,
  groupId,
  onPosted,
}: {
  userId: string;
  groupId?: string;
  onPosted?: () => void;
}) {
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const postButtonId = useId();
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState<"public" | "friends" | "private">("public");
  const [media, setMedia] = useState<{ url: string; kind: "image" | "video" }[]>([]);
  const [uploading, setUploading] = useState(false);

  const { data: me } = useQuery({ queryKey: ["profile", userId], queryFn: () => getProfile(userId) });

  useEffect(() => {
    const preferred = me?.default_post_visibility;
    if (preferred === "public" || preferred === "friends" || preferred === "private") {
      setVisibility(preferred);
    }
  }, [me?.default_post_visibility]);

  const publish = useMutation({
    mutationFn: () =>
      createPost({
        authorId: userId,
        content: content.trim(),
        mediaUrls: media.map((m) => m.url),
        mediaType: media[0]?.kind ?? null,
        visibility,
        groupId: groupId ?? null,
      }),
    onSuccess: () => {
      setContent("");
      setMedia([]);
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      queryClient.invalidateQueries({ queryKey: ["group-feed"] });
      queryClient.invalidateQueries({ queryKey: ["user-posts"] });
      onPosted?.();
      toast.success("Posted to the current");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploaded = await Promise.all(
        Array.from(files)
          .slice(0, 4)
          .map((file) => uploadMedia(file, userId)),
      );
      setMedia((current) => [...current, ...uploaded].slice(0, 4));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  const canPost = (content.trim().length > 0 || media.length > 0) && !publish.isPending && !uploading;

  return (
    <section className="rise rounded-2xl bg-bone-soft/60 p-4 ring-1 ring-black/5">
      <div className="flex gap-3">
        <UserAvatar name={me?.display_name ?? "You"} src={me?.avatar_url} />
        <div className="flex-1">
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={2}
            data-osk-action="Post"
            data-osk-submit={postButtonId}
            placeholder={groupId ? "Share something with the group…" : "Share something to the current…"}
            className="w-full resize-none rounded-xl bg-bone px-3 py-2 text-sm text-ink ring-1 ring-ink/10 outline-none placeholder:text-ink-soft/60 focus:ring-teal/40"
          />

          {media.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {media.map((item) => (
                <div key={item.url} className="relative">
                  {item.kind === "image" ? (
                    <img src={item.url} alt="" className="size-16 rounded-xl object-cover" />
                  ) : (
                    <video src={item.url} className="size-16 rounded-xl object-cover" muted />
                  )}
                  <button
                    onClick={() => setMedia((c) => c.filter((m) => m.url !== item.url))}
                    aria-label="Remove attachment"
                    className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-ink text-[10px] font-bold text-bone"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              ref={fileInput}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={(event) => handleFiles(event.target.files)}
            />
            <button
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
              className="font-display rounded-full px-3 py-1.5 text-xs font-semibold text-ink-soft ring-1 ring-ink/10 hover:bg-bone disabled:opacity-50"
            >
              {uploading ? "Uploading…" : "Photo / video"}
            </button>

            {!groupId && (
              <div className="font-display flex gap-1">
                {VISIBILITY.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setVisibility(option.value)}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                      visibility === option.value
                        ? "bg-teal text-bone"
                        : "text-ink-soft ring-1 ring-ink/10 hover:bg-bone",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}

            <button
              id={postButtonId}
              onClick={() => publish.mutate()}
              disabled={!canPost}
              className="font-display ml-auto rounded-full px-4 py-1.5 text-sm font-semibold text-teal ring-1 ring-teal/30 hover:bg-teal hover:text-bone disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-teal"
            >
              {publish.isPending ? "Posting…" : "Post"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
