import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { UserAvatar } from "./UserAvatar";
import { StoryComposer } from "./StoryComposer";
import { StoryViewer } from "./StoryViewer";
import { fetchStoryTray, subscribeToStories, type Story, type StoryGroup } from "@/lib/stories";
import { getProfile } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Card face: shows the story's actual content, not the profile picture. */
function StoryThumb({ story, label }: { story: Story; label: string }) {
  if (story.kind === "photo" && story.media_url) {
    return <img src={story.media_url} alt={label} className="absolute inset-0 size-full object-cover" />;
  }
  if (story.kind === "video" && story.media_url) {
    return (
      <video
        src={story.media_url}
        muted
        playsInline
        preload="metadata"
        className="absolute inset-0 size-full object-cover"
      />
    );
  }
  return (
    <span
      className="absolute inset-0 grid place-items-center p-2 text-center text-[11px] font-semibold leading-snug"
      style={{ background: story.background, color: story.text_color }}
    >
      <span className="line-clamp-4">{story.caption ?? ""}</span>
    </span>
  );
}

function StoryCard({
  group,
  seen,
  onOpen,
  label,
}: {
  group: StoryGroup;
  seen: boolean;
  onOpen: () => void;
  label: string;
}) {
  const latest = group.stories[group.stories.length - 1];
  return (
    <button
      onClick={onOpen}
      aria-label={label}
      className={cn(
        "relative h-36 w-24 shrink-0 overflow-hidden rounded-xl ring-1 ring-ink/10 transition-transform hover:scale-[1.02]",
        !group.stories.length && "bg-ink/5",
      )}
    >
      {latest && <StoryThumb story={latest} label={label} />}
      <span className="absolute inset-0 bg-gradient-to-b from-ink/25 via-transparent to-ink/45" />
      <span
        className={cn(
          "absolute left-2 top-2 block rounded-full p-[2px]",
          seen ? "bg-bone/70" : "bg-gradient-to-br from-clay via-amber to-teal",
        )}
      >
        <UserAvatar
          name={group.author.display_name}
          src={group.author.avatar_url}
          className="size-7 ring-2 ring-bone"
        />
      </span>
      <span className="font-display absolute inset-x-1.5 bottom-1.5 truncate text-left text-[11px] font-semibold text-bone drop-shadow">
        {label}
      </span>
    </button>
  );
}

export function StoriesTray({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const [composing, setComposing] = useState(false);
  const [viewing, setViewing] = useState<{ group: number; story: number } | null>(null);

  const me = useQuery({ queryKey: ["profile", userId], queryFn: () => getProfile(userId) });
  const tray = useQuery({
    queryKey: ["story-tray", userId],
    queryFn: () => fetchStoryTray(userId),
    refetchInterval: 60000,
  });

  useEffect(
    () =>
      subscribeToStories(() => {
        void queryClient.invalidateQueries({ queryKey: ["story-tray", userId] });
      }),
    [queryClient, userId],
  );

  const groups = tray.data ?? [];
  const mineIndex = groups.findIndex((group) => group.author.id === userId);
  const mine = mineIndex >= 0 ? groups[mineIndex] : null;
  const others = groups.filter((group) => group.author.id !== userId);


  return (
    <section aria-label="Stories" className="-mx-1 mb-4">
      <div className="flex gap-3 overflow-x-auto px-1 pb-1">
        {/* Your story — always the creation entry point */}
        <button
          onClick={() => setComposing(true)}
          className="relative h-36 w-24 shrink-0 overflow-hidden rounded-xl bg-ink/5 ring-1 ring-ink/10 transition-transform hover:scale-[1.02]"
          aria-label="Create your story"
        >
          <span className="absolute inset-x-0 top-0 h-2/3">
            {me.data?.avatar_url ? (
              <img
                src={me.data.avatar_url}
                alt=""
                className="absolute inset-0 size-full object-cover"
              />
            ) : (
              <span className="absolute inset-0 grid place-items-center bg-gradient-to-br from-clay/20 via-amber/20 to-teal/20">
                <UserAvatar
                  name={me.data?.display_name ?? "You"}
                  src={null}
                  className="size-10"
                />
              </span>
            )}
          </span>
          <span className="absolute inset-x-0 bottom-0 grid h-1/3 place-items-start justify-center bg-bone pt-4">
            <span className="font-display text-[11px] font-semibold">Your Story</span>
          </span>
          <span className="absolute left-1/2 top-2/3 grid size-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-teal text-bone ring-4 ring-bone">
            <Plus className="size-4" />
          </span>
        </button>

        {/* Your posted story sits right next to the posting tile */}
        {mine && (
          <StoryCard
            group={mine}
            seen={false}
            onOpen={() => setViewing({ group: mineIndex, story: 0 })}
            label="Your Story"
          />
        )}

        {others.map((group) => (
          <StoryCard
            key={group.author.id}
            group={group}
            seen={group.seen}
            onOpen={() => setViewing({ group: groups.indexOf(group), story: group.firstUnseen })}
            label={group.author.display_name.split(" ")[0] ?? "Story"}
          />
        ))}

        {!tray.isLoading && others.length === 0 && (
          <p className="self-center px-2 text-[11px] text-ink-soft">
            No stories from friends yet — share the first one.
          </p>
        )}
      </div>

      {composing && <StoryComposer userId={userId} onClose={() => setComposing(false)} />}
      {viewing !== null && groups.length > 0 && (
        <StoryViewer
          groups={groups}
          startIndex={Math.min(viewing.group, groups.length - 1)}
          startStoryIndex={viewing.story}
          userId={userId}
          onClose={() => setViewing(null)}
        />
      )}

    </section>
  );
}
