import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { uploadMedia } from "@/lib/media";
import { fetchSuggestions, sendFriendRequest, updateProfile } from "@/lib/api";
import { UserAvatar } from "@/components/flowtext/UserAvatar";
import { Wordmark } from "@/components/flowtext/Wordmark";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Set up your FlowText profile" },
      {
        name: "description",
        content:
          "Add a profile picture, pick a username, write a short bio and find people to follow on FlowText.",
      },
      { property: "og:title", content: "Set up your FlowText profile" },
      {
        property: "og:description",
        content: "Finish setting up your FlowText profile and find your people.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Onboarding,
});

const STEPS = ["Picture", "Username", "About you", "Interests", "Privacy", "People"] as const;

const INTEREST_OPTIONS = [
  "Music",
  "Football",
  "Photography",
  "Cooking",
  "Travel",
  "Gaming",
  "Art & design",
  "Books",
  "Fitness",
  "Movies",
  "Tech",
  "Fashion",
  "Faith",
  "Business",
  "Comedy",
  "Cars",
];

const USERNAME_RE = /^[a-zA-Z0-9._]{3,30}$/;

function Onboarding() {
  const navigate = useNavigate();
  const { userId } = Route.useRouteContext();
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameState, setUsernameState] = useState<"idle" | "checking" | "free" | "taken">(
    "idle",
  );
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [postVisibility, setPostVisibility] = useState<"public" | "friends" | "private">("friends");
  const [friendsVisibility, setFriendsVisibility] = useState<"public" | "friends" | "private">(
    "friends",
  );
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("display_name, avatar_url, username, bio, location, interests")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setDisplayName(data.display_name ?? "");
        setAvatarUrl(data.avatar_url ?? null);
        setUsername(data.username ?? "");
        setBio(data.bio ?? "");
        setLocation(data.location ?? "");
        if (data.interests) setInterests(data.interests.split(",").filter(Boolean));
      });
  }, [userId]);

  useEffect(() => {
    const value = username.trim();
    if (!USERNAME_RE.test(value)) {
      setUsernameState("idle");
      return;
    }
    setUsernameState("checking");
    const timer = window.setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .ilike("username", value)
        .neq("id", userId)
        .maybeSingle();
      setUsernameState(data ? "taken" : "free");
    }, 400);
    return () => window.clearTimeout(timer);
  }, [username, userId]);

  const usernameHint = useMemo(() => {
    const value = username.trim();
    if (!value) return "3–30 letters, numbers, dots or underscores.";
    if (!USERNAME_RE.test(value)) return "Use 3–30 letters, numbers, dots or underscores.";
    if (usernameState === "checking") return "Checking availability…";
    if (usernameState === "taken") return "That username is already taken.";
    if (usernameState === "free") return "That username is available.";
    return "";
  }, [username, usernameState]);

  async function pickAvatar(file: File) {
    setBusy(true);
    try {
      const uploaded = await uploadMedia(file, userId);
      setAvatarUrl(uploaded.url);
      await updateProfile(userId, { avatar_url: uploaded.url });
      toast.success("Profile picture added.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That picture wouldn't upload.");
    } finally {
      setBusy(false);
    }
  }

  async function saveStep() {
    setBusy(true);
    try {
      if (index === 1) {
        const value = username.trim();
        if (value) {
          const { error } = await supabase
            .from("profiles")
            .update({ username: value, ...(displayName.trim() ? {} : {}) })
            .eq("id", userId);
          if (error) throw error;
        }
      }
      if (index === 2) {
        await updateProfile(userId, { bio: bio.trim() || null, location: location.trim() || null });
      }
      if (index === 3) {
        await updateProfile(userId, { interests: interests.join(",") || null });
      }
      if (index === 4) {
        await updateProfile(userId, {
          default_post_visibility: postVisibility,
          friends_list_visibility: friendsVisibility,
        });
      }
      setIndex((value) => Math.min(value + 1, STEPS.length - 1));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We couldn't save that.");
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    setBusy(true);
    try {
      await supabase
        .from("profiles")
        .update({ onboarding_completed_at: new Date().toISOString() })
        .eq("id", userId);
      navigate({ to: "/feed" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-bone text-ink">
      <div className="chrome-bar h-1.5 w-full" />
      <div className="mx-auto max-w-md px-5 py-8">
        <Wordmark className="text-2xl" />

        <div className="mt-5 flex gap-1.5" aria-hidden>
          {STEPS.map((label, position) => (
            <span
              key={label}
              className={cn(
                "h-1 flex-1 rounded-full",
                position <= index ? "bg-clay" : "bg-ink/10",
              )}
            />
          ))}
        </div>
        <p className="font-display mt-2 text-[11px] font-semibold tracking-wide text-ink-soft uppercase">
          Step {index + 1} of {STEPS.length} — {STEPS[index]}
        </p>

        <div className="mt-5 rounded-2xl bg-card p-5 ring-1 ring-black/5">
          <div className="flex items-center gap-3">
            {index > 0 && (
              <button
                type="button"
                aria-label="Go back"
                onClick={() => setIndex((value) => value - 1)}
                className="rounded-full p-1.5 text-ink-soft ring-1 ring-ink/10 hover:bg-bone-soft"
              >
                ←
              </button>
            )}
            <h1 className="font-display text-lg font-semibold">
              {index === 0 && "Add a profile picture"}
              {index === 1 && "Choose your username"}
              {index === 2 && "Tell people about you"}
              {index === 3 && "What are you into?"}
              {index === 4 && "Your privacy"}
              {index === 5 && "Find people"}
            </h1>
          </div>

          <div className="mt-4 space-y-4">
            {index === 0 && (
              <>
                <p className="text-sm text-ink-soft">
                  A picture helps friends recognise you. You can change it any time.
                </p>
                <div className="flex flex-col items-center gap-3">
                  <UserAvatar
                    name={displayName || "New member"}
                    src={avatarUrl}
                    className="size-24"
                  />
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void pickAvatar(file);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={busy}
                    className="font-display rounded-full px-4 py-2 text-xs font-semibold text-ink ring-1 ring-ink/15 hover:bg-bone-soft disabled:opacity-50"
                  >
                    {busy ? "Uploading…" : avatarUrl ? "Change picture" : "Upload a picture"}
                  </button>
                </div>
              </>
            )}

            {index === 1 && (
              <>
                <p className="text-sm text-ink-soft">
                  Your username is how people find and mention you.
                </p>
                <label className="block">
                  <span className="font-display text-[11px] font-semibold tracking-wide text-ink-soft uppercase">
                    Username
                  </span>
                  <div className="mt-1 flex items-center rounded-xl bg-bone-soft px-3 ring-1 ring-ink/10 focus-within:ring-teal/40">
                    <span className="text-sm text-ink-soft">@</span>
                    <input
                      value={username}
                      autoFocus
                      onChange={(event) => setUsername(event.target.value.replace(/\s/g, ""))}
                      className="w-full bg-transparent px-1 py-2 text-sm outline-none"
                      placeholder="yourname"
                    />
                  </div>
                </label>
                <p
                  className={cn(
                    "text-xs",
                    usernameState === "taken" ? "text-clay-deep" : "text-ink-soft",
                  )}
                >
                  {usernameHint}
                </p>
              </>
            )}

            {index === 2 && (
              <>
                <label className="block">
                  <span className="font-display text-[11px] font-semibold tracking-wide text-ink-soft uppercase">
                    Short bio
                  </span>
                  <textarea
                    value={bio}
                    maxLength={160}
                    onChange={(event) => setBio(event.target.value)}
                    rows={3}
                    placeholder="A line about you"
                    className="mt-1 w-full resize-none rounded-xl bg-bone-soft px-3 py-2 text-sm outline-none ring-1 ring-ink/10 focus:ring-teal/40"
                  />
                </label>
                <p className="text-xs text-ink-soft">{160 - bio.length} characters left</p>
                <label className="block">
                  <span className="font-display text-[11px] font-semibold tracking-wide text-ink-soft uppercase">
                    Where you are
                  </span>
                  <input
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                    placeholder="Johannesburg, South Africa"
                    className="mt-1 w-full rounded-xl bg-bone-soft px-3 py-2 text-sm outline-none ring-1 ring-ink/10 focus:ring-teal/40"
                  />
                </label>
              </>
            )}

            {index === 3 && (
              <>
                <p className="text-sm text-ink-soft">
                  Pick a few — we use them to suggest people and groups.
                </p>
                <div className="flex flex-wrap gap-2">
                  {INTEREST_OPTIONS.map((option) => {
                    const active = interests.includes(option);
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() =>
                          setInterests((list) =>
                            active ? list.filter((item) => item !== option) : [...list, option],
                          )
                        }
                        className={cn(
                          "font-display rounded-full px-3 py-1.5 text-xs font-semibold",
                          active ? "bg-ink text-bone" : "text-ink-soft ring-1 ring-ink/10",
                        )}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {index === 4 && (
              <>
                <Choice
                  label="Who can see your posts by default"
                  value={postVisibility}
                  onChange={(value) => setPostVisibility(value as typeof postVisibility)}
                  options={[
                    ["public", "Everyone"],
                    ["friends", "Friends only"],
                    ["private", "Only me"],
                  ]}
                />
                <Choice
                  label="Who can see your friends list"
                  value={friendsVisibility}
                  onChange={(value) => setFriendsVisibility(value as typeof friendsVisibility)}
                  options={[
                    ["public", "Everyone"],
                    ["friends", "Friends only"],
                    ["private", "Only me"],
                  ]}
                />
                <p className="text-xs text-ink-soft">
                  You can fine-tune all of this later in Settings &amp; Privacy.
                </p>
              </>
            )}

            {index === 5 && <FindPeople userId={userId} />}

            <button
              type="button"
              disabled={busy || (index === 1 && usernameState === "taken")}
              onClick={index === STEPS.length - 1 ? finish : saveStep}
              className="font-display mt-2 w-full rounded-full bg-clay px-4 py-2.5 text-sm font-semibold text-bone hover:bg-clay-deep disabled:opacity-50"
            >
              {busy
                ? "Saving…"
                : index === STEPS.length - 1
                  ? "Go to my Feed"
                  : "Continue"}
            </button>

            <button
              type="button"
              onClick={() =>
                index === STEPS.length - 1
                  ? void finish()
                  : setIndex((value) => Math.min(value + 1, STEPS.length - 1))
              }
              className="w-full text-xs font-semibold text-ink-soft hover:text-ink"
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Choice({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <div>
      <span className="font-display text-[11px] font-semibold tracking-wide text-ink-soft uppercase">
        {label}
      </span>
      <div className="mt-2 space-y-2">
        {options.map(([option, optionLabel]) => (
          <label
            key={option}
            className="flex cursor-pointer items-center justify-between rounded-xl bg-bone-soft px-3 py-2 text-sm ring-1 ring-ink/10"
          >
            <span>{optionLabel}</span>
            <input
              type="radio"
              name={label}
              checked={value === option}
              onChange={() => onChange(option)}
              className="accent-teal"
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function FindPeople({ userId }: { userId: string }) {
  const [people, setPeople] = useState<
    { id: string; display_name: string; avatar_url: string | null }[]
  >([]);
  const [added, setAdded] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    fetchSuggestions(userId)
      .then((suggestions) => {
        if (!active) return;
        setPeople(
          suggestions.slice(0, 8).map(({ profile }) => ({
            id: profile.id,
            display_name: profile.display_name,
            avatar_url: profile.avatar_url,
          })),
        );
      })
      .catch(() => {
        /* suggestions are optional */
      });
    return () => {
      active = false;
    };
  }, [userId]);

  return (
    <div>
      <p className="text-sm text-ink-soft">
        People you might know. Adding friends fills up your feed — you can skip this.
      </p>
      <ul className="mt-3 space-y-2">
        {people.map((person) => (
          <li
            key={person.id}
            className="flex items-center gap-3 rounded-xl bg-bone-soft px-3 py-2 ring-1 ring-ink/5"
          >
            <UserAvatar name={person.display_name} src={person.avatar_url} className="size-9" />
            <span className="flex-1 truncate text-sm font-semibold">{person.display_name}</span>
            <button
              type="button"
              disabled={added.includes(person.id)}
              onClick={async () => {
                try {
                  await sendFriendRequest(userId, person.id);
                  setAdded((list) => [...list, person.id]);
                } catch {
                  toast.error("That request didn't send.");
                }
              }}
              className="font-display rounded-full bg-clay px-3 py-1.5 text-xs font-semibold text-bone disabled:opacity-50"
            >
              {added.includes(person.id) ? "Requested" : "Add friend"}
            </button>
          </li>
        ))}
        {people.length === 0 && (
          <li className="text-sm text-ink-soft">
            No suggestions yet — search for people once you're inside.
          </li>
        )}
      </ul>
    </div>
  );
}
