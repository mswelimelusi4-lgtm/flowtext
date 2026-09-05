import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate, useRouteContext } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell, RailCard, EmptyNote } from "@/components/flowtext/AppShell";
import { UserAvatar } from "@/components/flowtext/UserAvatar";
import { getProfile, updateProfile } from "@/lib/api";
import { uploadMedia } from "@/lib/media";
import { RELATIONSHIP_STATUSES } from "@/lib/profile";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Profile settings — FlowText" },
      {
        name: "description",
        content: "Edit your FlowText display name, bio, photos, location and work details.",
      },
      { property: "og:title", content: "Profile settings — FlowText" },
      { property: "og:description", content: "Edit your FlowText profile details and photos." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { userId } = useRouteContext({ from: "/_authenticated" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const avatarInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);

  const profile = useQuery({ queryKey: ["profile", userId], queryFn: () => getProfile(userId) });

  const [form, setForm] = useState({
    display_name: "",
    bio: "",
    location: "",
    work: "",
    education: "",
    current_city: "",
    hometown: "",
    relationship_status: "",
    partner_name: "",
    website: "",
    interests: "",
    favorite_quotes: "",
    about_extra: "",
    share_avatar_updates: true,
    avatar_url: "" as string | null,
    cover_url: "" as string | null,
  });

  useEffect(() => {
    if (!profile.data) return;
    setForm({
      display_name: profile.data.display_name,
      bio: profile.data.bio ?? "",
      location: profile.data.location ?? "",
      work: profile.data.work ?? "",
      education: profile.data.education ?? "",
      current_city: profile.data.current_city ?? "",
      hometown: profile.data.hometown ?? "",
      relationship_status: profile.data.relationship_status ?? "",
      partner_name: profile.data.partner_name ?? "",
      website: profile.data.website ?? "",
      interests: profile.data.interests ?? "",
      favorite_quotes: profile.data.favorite_quotes ?? "",
      about_extra: profile.data.about_extra ?? "",
      share_avatar_updates: profile.data.share_avatar_updates,
      avatar_url: profile.data.avatar_url,
      cover_url: profile.data.cover_url,
    });
  }, [profile.data]);

  const save = useMutation({
    mutationFn: () =>
      updateProfile(userId, {
        display_name: form.display_name.trim() || "New member",
        bio: form.bio.trim() || null,
        location: form.location.trim() || null,
        work: form.work.trim() || null,
        education: form.education.trim() || null,
        current_city: form.current_city.trim() || null,
        hometown: form.hometown.trim() || null,
        relationship_status: form.relationship_status.trim() || null,
        partner_name: form.partner_name.trim() || null,
        website: form.website.trim() || null,
        interests: form.interests.trim() || null,
        favorite_quotes: form.favorite_quotes.trim() || null,
        about_extra: form.about_extra.trim() || null,
        share_avatar_updates: form.share_avatar_updates,
        avatar_url: form.avatar_url,
        cover_url: form.cover_url,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      toast.success("Profile saved");
      navigate({ to: "/profile/$userId", params: { userId } });
    },
    onError: (error: Error) => toast.error(error.message),
  });


  async function pick(kind: "avatar" | "cover", files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    try {
      const uploaded = await uploadMedia(file, userId);
      setForm((current) => ({
        ...current,
        [kind === "avatar" ? "avatar_url" : "cover_url"]: uploaded.url,
      }));
      toast.success("Photo ready — save to keep it");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    }
  }

  return (
    <AppShell
      userId={userId}
      rail={
        <>
          <RailCard title="Privacy">
            <EmptyNote>
              Each post gets its own audience — public, friends-only or only me — right in the
              compose box.
            </EmptyNote>
          </RailCard>
          <RailCard title="More about you" tone="plain">
            <EmptyNote>
              Jobs, schools, places lived, family, contact info and life events live on your About
              page.
            </EmptyNote>
            <Link
              to="/about/$userId"
              params={{ userId }}
              className="font-display mt-2 block text-[11px] font-semibold text-clay-deep"
            >
              Edit About →
            </Link>
            <Link
              to="/account"
              className="font-display mt-1 block text-[11px] font-semibold text-clay-deep"
            >
              Account settings →
            </Link>
          </RailCard>
        </>
      }
    >
      <h1 className="font-display text-2xl font-bold">Profile settings</h1>
      <p className="mt-1 text-xs text-ink-soft">This is what other members see on your profile.</p>

      <section className="mt-5 space-y-4 rounded-2xl bg-card p-5 ring-1 ring-black/5">
        <div
          className="chrome-bar flex h-28 items-end justify-end rounded-xl p-3"
          style={
            form.cover_url
              ? {
                  backgroundImage: `url(${form.cover_url})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        >
          <input
            ref={coverInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => pick("cover", event.target.files)}
          />
          <button
            onClick={() => coverInput.current?.click()}
            className="font-display rounded-full bg-bone/90 px-3 py-1 text-[11px] font-semibold text-ink"
          >
            Change cover
          </button>
        </div>

        <div className="flex items-center gap-4">
          <UserAvatar
            name={form.display_name || "You"}
            src={form.avatar_url}
            className="size-16 text-lg"
          />
          <input
            ref={avatarInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => pick("avatar", event.target.files)}
          />
          <button
            onClick={() => avatarInput.current?.click()}
            className="font-display rounded-full px-3 py-1.5 text-xs font-semibold text-ink-soft ring-1 ring-ink/15 hover:bg-bone-soft"
          >
            Change profile photo
          </button>
        </div>

        <Field
          label="Display name"
          value={form.display_name}
          onChange={(value) => setForm((c) => ({ ...c, display_name: value }))}
        />
        <Field
          label="Bio"
          textarea
          value={form.bio}
          onChange={(value) => setForm((c) => ({ ...c, bio: value }))}
        />
        <Field
          label="Location"
          value={form.location}
          onChange={(value) => setForm((c) => ({ ...c, location: value }))}
        />
        <Field
          label="Work"
          value={form.work}
          onChange={(value) => setForm((c) => ({ ...c, work: value }))}
        />
        <Field
          label="Education"
          value={form.education}
          onChange={(value) => setForm((c) => ({ ...c, education: value }))}
        />
        <Field
          label="Current city"
          value={form.current_city}
          onChange={(value) => setForm((c) => ({ ...c, current_city: value }))}
        />
        <Field
          label="Hometown"
          value={form.hometown}
          onChange={(value) => setForm((c) => ({ ...c, hometown: value }))}
        />
        <div>
          <p className="font-display text-[11px] font-semibold tracking-wide text-ink-soft uppercase">
            Relationship status
          </p>
          <div className="font-display mt-1 flex flex-wrap gap-1 text-xs font-semibold">
            {RELATIONSHIP_STATUSES.map((status) => (
              <button
                key={status}
                onClick={() =>
                  setForm((c) => ({
                    ...c,
                    relationship_status: c.relationship_status === status ? "" : status,
                  }))
                }
                className={
                  form.relationship_status === status
                    ? "rounded-full bg-teal px-3 py-1.5 text-bone"
                    : "rounded-full px-3 py-1.5 text-ink-soft ring-1 ring-ink/10 hover:bg-bone-soft"
                }
              >
                {status}
              </button>
            ))}
          </div>
        </div>
        <Field
          label="With (partner's name, optional)"
          value={form.partner_name}
          onChange={(value) => setForm((c) => ({ ...c, partner_name: value }))}
        />
        <Field
          label="Website or social link"
          value={form.website}
          onChange={(value) => setForm((c) => ({ ...c, website: value }))}
        />
        <Field
          label="Interests"
          textarea
          value={form.interests}
          onChange={(value) => setForm((c) => ({ ...c, interests: value }))}
        />
        <Field
          label="Favourite quotes"
          textarea
          value={form.favorite_quotes}
          onChange={(value) => setForm((c) => ({ ...c, favorite_quotes: value }))}
        />
        <Field
          label="More about you"
          textarea
          value={form.about_extra}
          onChange={(value) => setForm((c) => ({ ...c, about_extra: value }))}
        />
        <label className="flex items-center justify-between gap-3 rounded-xl bg-bone-soft/70 px-3 py-2">
          <span className="text-sm">Share new profile pictures to the feed</span>
          <input
            type="checkbox"
            checked={form.share_avatar_updates}
            onChange={(event) =>
              setForm((c) => ({ ...c, share_avatar_updates: event.target.checked }))
            }
            className="size-4"
          />
        </label>

        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="font-display rounded-full bg-clay px-5 py-2 text-sm font-semibold text-bone hover:bg-clay-deep disabled:opacity-50"
        >
          {save.isPending ? "Saving…" : "Save profile"}
        </button>
      </section>
    </AppShell>
  );
}

function Field({
  label,
  value,
  onChange,
  textarea,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  textarea?: boolean;
}) {
  return (
    <label className="block">
      <span className="font-display text-[11px] font-semibold tracking-wide text-ink-soft uppercase">
        {label}
      </span>
      {textarea ? (
        <textarea
          value={value}
          rows={3}
          onChange={(event) => onChange(event.target.value)}
          className="mt-1 w-full resize-none rounded-xl bg-bone-soft px-3 py-2 text-sm outline-none ring-1 ring-ink/10 focus:ring-teal/40"
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="mt-1 w-full rounded-xl bg-bone-soft px-3 py-2 text-sm outline-none ring-1 ring-ink/10 focus:ring-teal/40"
        />
      )}
    </label>
  );
}
