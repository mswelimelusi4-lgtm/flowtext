import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { UserAvatar } from "./UserAvatar";
import { StoryComposer } from "./StoryComposer";
import { StoryViewer } from "./StoryViewer";
import { fetchStoryTray, subscribeToStories } from "@/lib/stories";
import { getProfile } from "@/lib/api";
import { cn } from "@/lib/utils";

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
  const hasMine = mineIndex >= 0;
  const others = groups.filter((group) => group.author.id !== userId);


  return (
    <section aria-label="Stories" className="-mx-1 mb-4">
      <div className="flex gap-3 overflow-x-auto px-1 pb-1">
        {/* Your story — always the creation entry point */}
        <button
          onClick={() => setComposing(true)}

          className="flex w-16 shrink-0 flex-col items-center gap-1.5"
          aria-label="Create your story"
        >
          <span className="relative">
            <span className="block rounded-full bg-ink/10 p-[2px]">
              <UserAvatar
                name={me.data?.display_name ?? "You"}
                src={me.data?.avatar_url ?? null}
                className="size-14 ring-2 ring-bone"
              />
            </span>
            <span className="absolute -right-0.5 -bottom-0.5 grid size-5 cursor-pointer place-items-center rounded-full bg-teal text-bone ring-2 ring-bone">
              <Plus className="size-3" />
            </span>
          </span>
          <span className="font-display w-full truncate text-[10px] font-semibold">Your Story</span>
        </button>

        {/* Your posted story sits right next to the posting tile */}
        {hasMine && (
          <button
            onClick={() => setViewing({ group: mineIndex, story: 0 })}
            className="flex w-16 shrink-0 flex-col items-center gap-1.5"
            aria-label="View your story"
          >
            <span className="block rounded-full bg-gradient-to-br from-clay via-amber to-teal p-[2px]">
              <UserAvatar
                name={me.data?.display_name ?? "You"}
                src={me.data?.avatar_url ?? null}
                className="size-14 ring-2 ring-bone"
              />
            </span>
            <span className="font-display w-full truncate text-[10px] font-semibold">
              {me.data?.display_name?.split(" ")[0] ?? "You"}
            </span>
          </button>
        )}

        {others.map((group) => (
          <button
            key={group.author.id}
            onClick={() =>
              setViewing({ group: groups.indexOf(group), story: group.firstUnseen })
            }

            className="flex w-16 shrink-0 flex-col items-center gap-1.5"
          >
            <span
              className={cn(
                "block rounded-full p-[2px]",
                group.seen ? "bg-ink/15" : "bg-gradient-to-br from-clay via-amber to-teal",
              )}
            >
              <UserAvatar
                name={group.author.display_name}
                src={group.author.avatar_url}
                className="size-14 ring-2 ring-bone"
              />
            </span>
            <span
              className={cn(
                "font-display w-full truncate text-[10px] font-semibold",
                group.seen && "text-ink-soft",
              )}
            >
              {group.author.display_name.split(" ")[0]}
            </span>
          </button>
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
