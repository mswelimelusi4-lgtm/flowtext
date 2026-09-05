import { useEffect, useRef, useState, type ReactNode } from "react";
import { createFileRoute, Link, useRouteContext } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell, EmptyNote, RailCard } from "@/components/flowtext/AppShell";
import { UserAvatar } from "@/components/flowtext/UserAvatar";
import { getProfile, searchAll, updateProfile } from "@/lib/api";
import { uploadMedia } from "@/lib/media";
import {
  addExperience,
  addFamilyMember,
  addLifeEvent,
  addPlace,
  fetchExperiences,
  fetchFamily,
  fetchLifeEvents,
  fetchPlaces,
  fetchPrivateInfo,
  removeExperience,
  removeFamilyMember,
  removeLifeEvent,
  removePlace,
  savePrivateInfo,
  FAMILY_RELATIONSHIPS,
  RELATIONSHIP_STATUSES,
} from "@/lib/profile";

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "work", label: "Work and Education" },
  { id: "places", label: "Places Lived" },
  { id: "contact", label: "Contact and Basic Info" },
  { id: "family", label: "Family Members" },
  { id: "details", label: "Details About You" },
  { id: "events", label: "Life Events" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

export const Route = createFileRoute("/_authenticated/about/$userId")({
  validateSearch: (search: Record<string, unknown>): { section?: SectionId } => {
    const value = search["section"];
    const match = SECTIONS.find((section) => section.id === value);
    return match ? { section: match.id } : {};
  },
  head: () => ({
    meta: [
      { title: "About — FlowText" },
      {
        name: "description",
        content:
          "Work, education, places lived, contact details, family, life events and more about a FlowText member.",
      },
      { property: "og:title", content: "About — FlowText" },
      { property: "og:description", content: "The full about section of a FlowText profile." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  const { userId: myId } = useRouteContext({ from: "/_authenticated" });
  const { userId } = Route.useParams();
  const { section = "overview" } = Route.useSearch();
  const isMe = userId === myId;
  const queryClient = useQueryClient();

  const profile = useQuery({ queryKey: ["profile", userId], queryFn: () => getProfile(userId) });
  const experiences = useQuery({
    queryKey: ["experiences", userId],
    queryFn: () => fetchExperiences(userId),
  });
  const places = useQuery({ queryKey: ["places", userId], queryFn: () => fetchPlaces(userId) });
  const family = useQuery({ queryKey: ["family", userId], queryFn: () => fetchFamily(userId) });
  const events = useQuery({ queryKey: ["life-events", userId], queryFn: () => fetchLifeEvents(userId) });
  const priv = useQuery({
    queryKey: ["private-info", userId],
    queryFn: () => fetchPrivateInfo(userId),
    enabled: isMe,
  });

  const refresh = (key: string) => queryClient.invalidateQueries({ queryKey: [key, userId] });

  return (
    <AppShell
      userId={myId}
      rail={
        <RailCard title="Sections">
          <ul className="font-display space-y-1 text-xs font-semibold">
            {SECTIONS.map((item) => (
              <li key={item.id}>
                <Link
                  to="/about/$userId"
                  params={{ userId }}
                  search={{ section: item.id }}
                  className={
                    section === item.id
                      ? "block rounded-lg bg-ink px-3 py-1.5 text-bone"
                      : "block rounded-lg px-3 py-1.5 text-ink-soft hover:bg-bone-soft"
                  }
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </RailCard>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">About</h1>
          <p className="mt-1 text-xs text-ink-soft">
            {profile.data?.display_name ?? "Member"}
            {isMe ? " · everything here is yours to edit" : ""}
          </p>
        </div>
        <Link
          to="/profile/$userId"
          params={{ userId }}
          className="font-display rounded-full px-4 py-1.5 text-xs font-semibold text-ink-soft ring-1 ring-ink/15 hover:bg-bone-soft"
        >
          Back to profile
        </Link>
      </div>

      <div className="font-display mt-4 flex flex-wrap gap-1 text-xs font-semibold lg:hidden">
        {SECTIONS.map((item) => (
          <Link
            key={item.id}
            to="/about/$userId"
            params={{ userId }}
            search={{ section: item.id }}
            className={
              section === item.id
                ? "rounded-full bg-ink px-3 py-1.5 text-bone"
                : "rounded-full px-3 py-1.5 text-ink-soft ring-1 ring-ink/10"
            }
          >
            {item.label}
          </Link>
        ))}
      </div>

      <div className="mt-5 space-y-4">
        {section === "overview" && (
          <Card title="Overview">
            {profile.isLoading && <Skeleton />}
            <dl className="space-y-2 text-sm">
              <Row label="Work">
                {(experiences.data ?? [])
                  .filter((item) => item.kind === "work")
                  .map((job) => [job.title, job.organization].filter(Boolean).join(" at "))
                  .join(" · ") || null}
              </Row>
              <Row label="Education">
                {(experiences.data ?? [])
                  .filter((item) => item.kind === "school")
                  .map((school) => [school.degree, school.organization].filter(Boolean).join(" at "))
                  .join(" · ") || null}
              </Row>
              <Row label="Current city">{profile.data?.current_city}</Row>
              <Row label="Hometown">{profile.data?.hometown}</Row>
              <Row label="Relationship">
                {profile.data?.relationship_status
                  ? profile.data.relationship_status +
                    (profile.data.partner_name ? ` with ${profile.data.partner_name}` : "")
                  : null}
              </Row>
              <Row label="Website">{profile.data?.website}</Row>
              <Row label="Joined">
                {profile.data
                  ? new Date(profile.data.created_at).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  : null}
              </Row>
            </dl>
            {isMe && (
              <RelationshipEditor
                status={profile.data?.relationship_status ?? ""}
                partner={profile.data?.partner_name ?? ""}
                city={profile.data?.current_city ?? ""}
                hometown={profile.data?.hometown ?? ""}
                website={profile.data?.website ?? ""}
                onSave={async (patch) => {
                  await updateProfile(myId, patch);
                  refresh("profile");
                  toast.success("Overview updated");
                }}
              />
            )}
          </Card>
        )}

        {section === "work" && (
          <Card title="Work and Education">
            {experiences.isLoading && <Skeleton />}
            {(experiences.data ?? []).length === 0 && <EmptyNote>Nothing added yet.</EmptyNote>}
            <ul className="space-y-2">
              {(experiences.data ?? []).map((item) => (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-3 rounded-xl bg-bone-soft/70 p-3"
                >
                  <div>
                    <p className="text-sm font-semibold">
                      {item.kind === "work"
                        ? [item.title, item.organization].filter(Boolean).join(" at ")
                        : [item.degree, item.organization].filter(Boolean).join(" at ")}
                    </p>
                    <p className="text-[11px] text-ink-soft">
                      {item.kind === "work" ? "Job" : "School"} ·{" "}
                      {item.start_date ? item.start_date : "—"} –{" "}
                      {item.is_current ? "present" : (item.end_date ?? "—")}
                    </p>
                    {item.description && (
                      <p className="mt-1 text-xs text-ink-soft">{item.description}</p>
                    )}
                  </div>
                  {isMe && (
                    <RemoveButton
                      onClick={async () => {
                        await removeExperience(item.id);
                        refresh("experiences");
                      }}
                    />
                  )}
                </li>
              ))}
            </ul>
            {isMe && (
              <ExperienceForm
                onAdd={async (input) => {
                  await addExperience({ ...input, user_id: myId });
                  refresh("experiences");
                  toast.success("Added");
                }}
              />
            )}
          </Card>
        )}

        {section === "places" && (
          <Card title="Places Lived">
            {places.isLoading && <Skeleton />}
            {(places.data ?? []).length === 0 && <EmptyNote>No places added yet.</EmptyNote>}
            <ul className="space-y-2">
              {(places.data ?? []).map((place) => (
                <li
                  key={place.id}
                  className="flex items-center justify-between rounded-xl bg-bone-soft/70 p-3"
                >
                  <div>
                    <p className="text-sm font-semibold">{place.name}</p>
                    <p className="text-[11px] text-ink-soft">
                      {place.kind === "current"
                        ? "Current city"
                        : place.kind === "hometown"
                          ? "Hometown"
                          : "Lived here"}
                      {place.year ? ` · ${place.year}` : ""}
                    </p>
                  </div>
                  {isMe && (
                    <RemoveButton
                      onClick={async () => {
                        await removePlace(place.id);
                        refresh("places");
                      }}
                    />
                  )}
                </li>
              ))}
            </ul>
            {isMe && (
              <PlaceForm
                onAdd={async (input) => {
                  await addPlace({ ...input, user_id: myId });
                  refresh("places");
                  toast.success("Place added");
                }}
              />
            )}
          </Card>
        )}

        {section === "contact" && (
          <Card title="Contact and Basic Info">
            {!isMe ? (
              <EmptyNote>
                Contact and basic info is private — only this member can see it.
              </EmptyNote>
            ) : (
              <ContactForm
                initial={priv.data}
                onSave={async (patch) => {
                  await savePrivateInfo(myId, patch);
                  queryClient.invalidateQueries({ queryKey: ["private-info", myId] });
                  toast.success("Contact info saved");
                }}
              />
            )}
          </Card>
        )}

        {section === "family" && (
          <Card title="Family Members">
            {family.isLoading && <Skeleton />}
            {(family.data ?? []).length === 0 && <EmptyNote>No family added yet.</EmptyNote>}
            <ul className="space-y-2">
              {(family.data ?? []).map((member) => (
                <li
                  key={member.id}
                  className="flex items-center justify-between rounded-xl bg-bone-soft/70 p-3"
                >
                  <Link
                    to="/profile/$userId"
                    params={{ userId: member.relative_id }}
                    className="flex items-center gap-3"
                  >
                    <UserAvatar
                      name={member.relative?.display_name ?? "Member"}
                      src={member.relative?.avatar_url}
                      className="size-9"
                    />
                    <span>
                      <span className="block text-sm font-semibold">
                        {member.relative?.display_name ?? "Member"}
                      </span>
                      <span className="block text-[11px] text-ink-soft">{member.relationship}</span>
                    </span>
                  </Link>
                  {isMe && (
                    <RemoveButton
                      onClick={async () => {
                        await removeFamilyMember(member.id);
                        refresh("family");
                      }}
                    />
                  )}
                </li>
              ))}
            </ul>
            {isMe && (
              <FamilyForm
                onAdd={async (relativeId, relationship) => {
                  await addFamilyMember(myId, relativeId, relationship);
                  refresh("family");
                  toast.success("Family member added");
                }}
              />
            )}
          </Card>
        )}

        {section === "details" && (
          <Card title="Details About You">
            <dl className="space-y-2 text-sm">
              <Row label="About">{profile.data?.bio}</Row>
              <Row label="Interests">{profile.data?.interests}</Row>
              <Row label="Favourite quotes">{profile.data?.favorite_quotes}</Row>
              <Row label="More">{profile.data?.about_extra}</Row>
            </dl>
            {isMe && (
              <DetailsForm
                bio={profile.data?.bio ?? ""}
                interests={profile.data?.interests ?? ""}
                quotes={profile.data?.favorite_quotes ?? ""}
                extra={profile.data?.about_extra ?? ""}
                onSave={async (patch) => {
                  await updateProfile(myId, patch);
                  refresh("profile");
                  toast.success("Details saved");
                }}
              />
            )}
          </Card>
        )}

        {section === "events" && (
          <Card title="Life Events">
            {events.isLoading && <Skeleton />}
            {(events.data ?? []).length === 0 && <EmptyNote>No life events yet.</EmptyNote>}
            <ol className="thread-line space-y-3">
              {(events.data ?? []).map((event) => (
                <li key={event.id} className="rounded-xl bg-bone-soft/70 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{event.title}</p>
                      <p className="text-[11px] text-ink-soft">
                        {new Date(event.event_date).toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                      {event.description && (
                        <p className="mt-1 text-xs text-ink-soft">{event.description}</p>
                      )}
                    </div>
                    {isMe && (
                      <RemoveButton
                        onClick={async () => {
                          await removeLifeEvent(event.id);
                          refresh("life-events");
                        }}
                      />
                    )}
                  </div>
                  {event.photo_url && (
                    <img
                      src={event.photo_url}
                      alt=""
                      loading="lazy"
                      className="mt-2 max-h-52 w-full rounded-lg object-cover"
                    />
                  )}
                </li>
              ))}
            </ol>
            {isMe && (
              <LifeEventForm
                userId={myId}
                onAdd={async (input) => {
                  await addLifeEvent({ ...input, user_id: myId });
                  refresh("life-events");
                  toast.success("Life event added");
                }}
              />
            )}
          </Card>
        )}
      </div>
    </AppShell>
  );
}

/* ---------- shared bits ---------- */

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl bg-card p-5 ring-1 ring-black/5">
      <h2 className="font-display text-sm font-bold tracking-wide uppercase">{title}</h2>
      {children}
    </section>
  );
}

function Skeleton() {
  return <div className="h-16 animate-pulse rounded-xl bg-bone-soft" />;
}

function Row({ label, children }: { label: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <div className="flex flex-wrap gap-2">
      <dt className="w-32 shrink-0 text-xs text-ink-soft">{label}</dt>
      <dd className="text-sm font-medium">{children}</dd>
    </div>
  );
}

function RemoveButton({ onClick }: { onClick: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      onClick={async () => {
        setBusy(true);
        try {
          await onClick();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Could not remove");
        } finally {
          setBusy(false);
        }
      }}
      disabled={busy}
      className="font-display shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold text-clay-deep ring-1 ring-clay/30 hover:bg-clay hover:text-bone disabled:opacity-50"
    >
      Remove
    </button>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="font-display text-[11px] font-semibold tracking-wide text-ink-soft uppercase">
        {label}
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-xl bg-bone-soft px-3 py-2 text-sm outline-none ring-1 ring-ink/10 focus:ring-teal/40"
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[] | { value: string; label: string }[];
}) {
  const items = options.map((option) =>
    typeof option === "string" ? { value: option, label: option } : option,
  );
  return (
    <label className="block">
      <span className="font-display text-[11px] font-semibold tracking-wide text-ink-soft uppercase">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-xl bg-bone-soft px-3 py-2 text-sm outline-none ring-1 ring-ink/10 focus:ring-teal/40"
      >
        <option value="">—</option>
        {items.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SaveButton({ onClick, label = "Save" }: { onClick: () => Promise<void>; label?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      onClick={async () => {
        setBusy(true);
        try {
          await onClick();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Could not save");
        } finally {
          setBusy(false);
        }
      }}
      disabled={busy}
      className="font-display rounded-full bg-clay px-5 py-2 text-xs font-semibold text-bone hover:bg-clay-deep disabled:opacity-50"
    >
      {busy ? "Saving…" : label}
    </button>
  );
}

/* ---------- editors ---------- */

function RelationshipEditor({
  status,
  partner,
  city,
  hometown,
  website,
  onSave,
}: {
  status: string;
  partner: string;
  city: string;
  hometown: string;
  website: string;
  onSave: (patch: {
    relationship_status: string | null;
    partner_name: string | null;
    current_city: string | null;
    hometown: string | null;
    website: string | null;
  }) => Promise<void>;
}) {
  const [form, setForm] = useState({ status, partner, city, hometown, website });
  useEffect(() => {
    setForm({ status, partner, city, hometown, website });
  }, [status, partner, city, hometown, website]);

  return (
    <div className="space-y-3 border-t border-ink/10 pt-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label="Relationship status"
          value={form.status}
          onChange={(value) => setForm((c) => ({ ...c, status: value }))}
          options={RELATIONSHIP_STATUSES}
        />
        <Input
          label="With (partner name)"
          value={form.partner}
          onChange={(value) => setForm((c) => ({ ...c, partner: value }))}
        />
        <Input
          label="Current city"
          value={form.city}
          onChange={(value) => setForm((c) => ({ ...c, city: value }))}
        />
        <Input
          label="Hometown"
          value={form.hometown}
          onChange={(value) => setForm((c) => ({ ...c, hometown: value }))}
        />
        <Input
          label="Website or social link"
          value={form.website}
          onChange={(value) => setForm((c) => ({ ...c, website: value }))}
          placeholder="https://"
        />
      </div>
      <SaveButton
        onClick={() =>
          onSave({
            relationship_status: form.status.trim() || null,
            partner_name: form.partner.trim() || null,
            current_city: form.city.trim() || null,
            hometown: form.hometown.trim() || null,
            website: form.website.trim() || null,
          })
        }
      />
    </div>
  );
}

function ExperienceForm({
  onAdd,
}: {
  onAdd: (input: {
    kind: "work" | "school";
    title: string | null;
    organization: string;
    degree: string | null;
    start_date: string | null;
    end_date: string | null;
    is_current: boolean;
    description: string | null;
  }) => Promise<void>;
}) {
  const [form, setForm] = useState({
    kind: "work" as "work" | "school",
    title: "",
    organization: "",
    degree: "",
    start: "",
    end: "",
    current: false,
    description: "",
  });

  return (
    <div className="space-y-3 border-t border-ink/10 pt-3">
      <div className="font-display flex gap-1 text-xs font-semibold">
        {(["work", "school"] as const).map((kind) => (
          <button
            key={kind}
            onClick={() => setForm((c) => ({ ...c, kind }))}
            className={
              form.kind === kind
                ? "rounded-full bg-ink px-3 py-1.5 text-bone"
                : "rounded-full px-3 py-1.5 text-ink-soft ring-1 ring-ink/10"
            }
          >
            {kind === "work" ? "Add a job" : "Add a school"}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {form.kind === "work" ? (
          <Input
            label="Job title"
            value={form.title}
            onChange={(value) => setForm((c) => ({ ...c, title: value }))}
          />
        ) : (
          <Input
            label="Degree or field"
            value={form.degree}
            onChange={(value) => setForm((c) => ({ ...c, degree: value }))}
          />
        )}
        <Input
          label={form.kind === "work" ? "Company" : "School"}
          value={form.organization}
          onChange={(value) => setForm((c) => ({ ...c, organization: value }))}
        />
        <Input
          label="Start date"
          type="date"
          value={form.start}
          onChange={(value) => setForm((c) => ({ ...c, start: value }))}
        />
        <Input
          label="End date"
          type="date"
          value={form.end}
          onChange={(value) => setForm((c) => ({ ...c, end: value }))}
        />
      </div>
      <label className="flex items-center gap-2 text-xs text-ink-soft">
        <input
          type="checkbox"
          checked={form.current}
          onChange={(event) => setForm((c) => ({ ...c, current: event.target.checked }))}
        />
        {form.kind === "work" ? "I currently work here" : "I currently study here"}
      </label>
      <Input
        label="Description"
        value={form.description}
        onChange={(value) => setForm((c) => ({ ...c, description: value }))}
      />
      <SaveButton
        label="Add entry"
        onClick={async () => {
          if (!form.organization.trim()) throw new Error("Add the company or school name");
          await onAdd({
            kind: form.kind,
            title: form.title.trim() || null,
            organization: form.organization.trim(),
            degree: form.degree.trim() || null,
            start_date: form.start || null,
            end_date: form.current ? null : form.end || null,
            is_current: form.current,
            description: form.description.trim() || null,
          });
          setForm({
            kind: form.kind,
            title: "",
            organization: "",
            degree: "",
            start: "",
            end: "",
            current: false,
            description: "",
          });
        }}
      />
    </div>
  );
}

function PlaceForm({
  onAdd,
}: {
  onAdd: (input: { kind: "current" | "hometown" | "other"; name: string; year: number | null }) => Promise<void>;
}) {
  const [form, setForm] = useState({ kind: "other" as "current" | "hometown" | "other", name: "", year: "" });
  return (
    <div className="space-y-3 border-t border-ink/10 pt-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Select
          label="Type"
          value={form.kind}
          onChange={(value) => setForm((c) => ({ ...c, kind: value as typeof c.kind }))}
          options={[
            { value: "current", label: "Current city" },
            { value: "hometown", label: "Hometown" },
            { value: "other", label: "Other place" },
          ]}
        />
        <Input
          label="Place"
          value={form.name}
          onChange={(value) => setForm((c) => ({ ...c, name: value }))}
        />
        <Input
          label="Year"
          value={form.year}
          onChange={(value) => setForm((c) => ({ ...c, year: value }))}
        />
      </div>
      <SaveButton
        label="Add place"
        onClick={async () => {
          if (!form.name.trim()) throw new Error("Add the place name");
          await onAdd({
            kind: form.kind,
            name: form.name.trim(),
            year: form.year ? Number(form.year) : null,
          });
          setForm({ kind: "other", name: "", year: "" });
        }}
      />
    </div>
  );
}

function ContactForm({
  initial,
  onSave,
}: {
  initial: {
    phone: string | null;
    contact_email: string | null;
    birthday: string | null;
    gender: string | null;
    languages: string[];
  } | null | undefined;
  onSave: (patch: {
    phone: string | null;
    contact_email: string | null;
    birthday: string | null;
    gender: string | null;
    languages: string[];
  }) => Promise<void>;
}) {
  const [form, setForm] = useState({
    phone: "",
    email: "",
    birthday: "",
    gender: "",
    languages: "",
  });

  useEffect(() => {
    if (!initial) return;
    setForm({
      phone: initial.phone ?? "",
      email: initial.contact_email ?? "",
      birthday: initial.birthday ?? "",
      gender: initial.gender ?? "",
      languages: (initial.languages ?? []).join(", "),
    });
  }, [initial]);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Phone number"
          value={form.phone}
          onChange={(value) => setForm((c) => ({ ...c, phone: value }))}
        />
        <Input
          label="Contact email"
          value={form.email}
          onChange={(value) => setForm((c) => ({ ...c, email: value }))}
        />
        <Input
          label="Birthday"
          type="date"
          value={form.birthday}
          onChange={(value) => setForm((c) => ({ ...c, birthday: value }))}
        />
        <Select
          label="Gender"
          value={form.gender}
          onChange={(value) => setForm((c) => ({ ...c, gender: value }))}
          options={["Female", "Male", "Non-binary", "Prefer not to say", "Custom"]}
        />
        <Input
          label="Languages spoken"
          value={form.languages}
          onChange={(value) => setForm((c) => ({ ...c, languages: value }))}
          placeholder="English, Zulu, Portuguese"
        />
      </div>
      <SaveButton
        onClick={() =>
          onSave({
            phone: form.phone.trim() || null,
            contact_email: form.email.trim() || null,
            birthday: form.birthday || null,
            gender: form.gender.trim() || null,
            languages: form.languages
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean),
          })
        }
      />
    </div>
  );
}

function FamilyForm({
  onAdd,
}: {
  onAdd: (relativeId: string, relationship: string) => Promise<void>;
}) {
  const [term, setTerm] = useState("");
  const [relationship, setRelationship] = useState("Sibling");
  const results = useQuery({
    queryKey: ["family-search", term],
    queryFn: () => searchAll(term),
    enabled: term.trim().length > 1,
  });

  return (
    <div className="space-y-3 border-t border-ink/10 pt-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Find a member" value={term} onChange={setTerm} placeholder="Search by name" />
        <Select
          label="Relationship"
          value={relationship}
          onChange={setRelationship}
          options={FAMILY_RELATIONSHIPS}
        />
      </div>
      <ul className="space-y-1">
        {(results.data?.people ?? []).map((person) => (
          <li key={person.id} className="flex items-center justify-between rounded-xl bg-bone-soft/70 p-2">
            <span className="flex items-center gap-2">
              <UserAvatar name={person.display_name} src={person.avatar_url} className="size-8" />
              <span className="text-sm font-medium">{person.display_name}</span>
            </span>
            <button
              onClick={async () => {
                try {
                  await onAdd(person.id, relationship);
                  setTerm("");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Could not add");
                }
              }}
              className="font-display rounded-full bg-teal px-3 py-1 text-[11px] font-semibold text-bone"
            >
              Add
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DetailsForm({
  bio,
  interests,
  quotes,
  extra,
  onSave,
}: {
  bio: string;
  interests: string;
  quotes: string;
  extra: string;
  onSave: (patch: {
    bio: string | null;
    interests: string | null;
    favorite_quotes: string | null;
    about_extra: string | null;
  }) => Promise<void>;
}) {
  const [form, setForm] = useState({ bio, interests, quotes, extra });
  useEffect(() => {
    setForm({ bio, interests, quotes, extra });
  }, [bio, interests, quotes, extra]);

  return (
    <div className="space-y-3 border-t border-ink/10 pt-3">
      <Input label="About you" value={form.bio} onChange={(value) => setForm((c) => ({ ...c, bio: value }))} />
      <Input
        label="Personal interests"
        value={form.interests}
        onChange={(value) => setForm((c) => ({ ...c, interests: value }))}
      />
      <Input
        label="Favourite quotes"
        value={form.quotes}
        onChange={(value) => setForm((c) => ({ ...c, quotes: value }))}
      />
      <Input
        label="Other details"
        value={form.extra}
        onChange={(value) => setForm((c) => ({ ...c, extra: value }))}
      />
      <SaveButton
        onClick={() =>
          onSave({
            bio: form.bio.trim() || null,
            interests: form.interests.trim() || null,
            favorite_quotes: form.quotes.trim() || null,
            about_extra: form.extra.trim() || null,
          })
        }
      />
    </div>
  );
}

function LifeEventForm({
  userId,
  onAdd,
}: {
  userId: string;
  onAdd: (input: {
    title: string;
    event_date: string;
    description: string | null;
    photo_url: string | null;
  }) => Promise<void>;
}) {
  const [form, setForm] = useState({ title: "", date: "", description: "", photo: "" });
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function pick(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadMedia(file, userId);
      setForm((c) => ({ ...c, photo: uploaded.url }));
      toast.success("Photo ready");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3 border-t border-ink/10 pt-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Title" value={form.title} onChange={(value) => setForm((c) => ({ ...c, title: value }))} />
        <Input
          label="Date"
          type="date"
          value={form.date}
          onChange={(value) => setForm((c) => ({ ...c, date: value }))}
        />
      </div>
      <Input
        label="Description"
        value={form.description}
        onChange={(value) => setForm((c) => ({ ...c, description: value }))}
      />
      <div className="flex items-center gap-3">
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => pick(event.target.files)}
        />
        <button
          onClick={() => fileInput.current?.click()}
          disabled={uploading}
          className="font-display rounded-full px-3 py-1.5 text-xs font-semibold text-ink-soft ring-1 ring-ink/15 hover:bg-bone-soft disabled:opacity-50"
        >
          {uploading ? "Uploading…" : form.photo ? "Photo added" : "Add a photo"}
        </button>
        {form.photo && <img src={form.photo} alt="" className="size-10 rounded-lg object-cover" />}
      </div>
      <SaveButton
        label="Add life event"
        onClick={async () => {
          if (!form.title.trim() || !form.date) throw new Error("Add a title and a date");
          await onAdd({
            title: form.title.trim(),
            event_date: form.date,
            description: form.description.trim() || null,
            photo_url: form.photo || null,
          });
          setForm({ title: "", date: "", description: "", photo: "" });
        }}
      />
    </div>
  );
}
