import { useEffect, useState, type ReactNode } from "react";
import { createFileRoute, Link, useNavigate, useRouteContext } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, EmptyNote, RailCard } from "@/components/flowtext/AppShell";
import { UserAvatar } from "@/components/flowtext/UserAvatar";
import { getProfile, globalSearch, updateProfile } from "@/lib/api";
import { deleteMyAccount } from "@/lib/account.functions";
import {
  AUDIENCES,
  blockUser,
  changeEmail,
  changePassword,
  changePhone,
  confirmTwoFactor,
  currentDeviceId,
  deactivateAccount,
  disableTwoFactor,
  exportAccountData,
  fetchBlocked,
  fetchDevices,
  fetchNotificationPrefs,
  fetchPrivateInfo,
  reauthenticate,
  registerDevice,
  revokeDevice,
  saveNotificationPrefs,
  savePrivateInfo,
  startTwoFactor,
  unblockUser,
} from "@/lib/profile";

const SECTIONS = [
  { id: "personal", label: "Personal Information" },
  { id: "security", label: "Password and Security" },
  { id: "privacy", label: "Privacy" },
  { id: "blocking", label: "Blocking" },
  { id: "notifications", label: "Notifications" },
  { id: "your-info", label: "Your Information" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

export const Route = createFileRoute("/_authenticated/account")({
  validateSearch: (search: Record<string, unknown>): { section?: SectionId } => {
    const match = SECTIONS.find((section) => section.id === search["section"]);
    return match ? { section: match.id } : {};
  },
  head: () => ({
    meta: [
      { title: "Account settings — FlowText" },
      {
        name: "description",
        content:
          "Manage your FlowText account: personal information, password and security, privacy, blocking, notifications and your data.",
      },
      { property: "og:title", content: "Account settings — FlowText" },
      { property: "og:description", content: "Private account controls for your FlowText account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { userId, user } = useRouteContext({ from: "/_authenticated" });
  const { section = "personal" } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const email = user.email ?? "";

  const profile = useQuery({ queryKey: ["profile", userId], queryFn: () => getProfile(userId) });
  const priv = useQuery({ queryKey: ["private-info", userId], queryFn: () => fetchPrivateInfo(userId) });
  const prefs = useQuery({ queryKey: ["notif-prefs", userId], queryFn: () => fetchNotificationPrefs(userId) });
  const blocked = useQuery({ queryKey: ["blocked", userId], queryFn: () => fetchBlocked(userId) });
  const devices = useQuery({ queryKey: ["devices", userId], queryFn: () => fetchDevices(userId) });

  useEffect(() => {
    void registerDevice(userId).then(() =>
      queryClient.invalidateQueries({ queryKey: ["devices", userId] }),
    );
  }, [userId, queryClient]);

  const savePrivacy = useMutation({
    mutationFn: (patch: Record<string, unknown>) => updateProfile(userId, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      toast.success("Privacy updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell
      userId={userId}
      rail={
        <>
          <RailCard title="Sections">
            <ul className="font-display space-y-1 text-xs font-semibold">
              {SECTIONS.map((item) => (
                <li key={item.id}>
                  <Link
                    to="/account"
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
          <RailCard title="Public profile" tone="plain">
            <EmptyNote>
              Anything here is private to you. Your public profile lives under Profile settings.
            </EmptyNote>
            <Link
              to="/settings"
              className="font-display mt-2 inline-block text-[11px] font-semibold text-clay-deep"
            >
              Edit public profile →
            </Link>
          </RailCard>
        </>
      }
    >
      <h1 className="font-display text-2xl font-bold">Account settings</h1>
      <p className="mt-1 text-xs text-ink-soft">Only you can see and change what's on this page.</p>

      <div className="font-display mt-4 flex flex-wrap gap-1 text-xs font-semibold lg:hidden">
        {SECTIONS.map((item) => (
          <Link
            key={item.id}
            to="/account"
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
        {section === "personal" && (
          <PersonalSection
            userId={userId}
            email={email}
            displayName={profile.data?.display_name ?? ""}
            phone={priv.data?.phone ?? ""}
            birthday={priv.data?.birthday ?? ""}
            gender={priv.data?.gender ?? ""}
            onDone={() => {
              queryClient.invalidateQueries({ queryKey: ["profile", userId] });
              queryClient.invalidateQueries({ queryKey: ["private-info", userId] });
            }}
          />
        )}

        {section === "security" && (
          <SecuritySection
            userId={userId}
            email={email}
            twoFactorOn={profile.data?.two_factor_enabled ?? false}
            devices={devices.data ?? []}
            loadingDevices={devices.isLoading}
            onDone={() => {
              queryClient.invalidateQueries({ queryKey: ["profile", userId] });
              queryClient.invalidateQueries({ queryKey: ["devices", userId] });
            }}
          />
        )}

        {section === "privacy" && (
          <Card title="Privacy">
            {profile.isLoading && <Skeleton />}
            <Choice
              label="Who can see your future posts"
              value={profile.data?.default_post_visibility ?? "public"}
              options={AUDIENCES}
              onChange={(value) => savePrivacy.mutate({ default_post_visibility: value })}
            />
            <Choice
              label="Who can see your friends list"
              value={profile.data?.friends_list_visibility ?? "public"}
              options={AUDIENCES}
              onChange={(value) => savePrivacy.mutate({ friends_list_visibility: value })}
            />
            <Choice
              label="Who can send you friend requests"
              value={profile.data?.friend_request_scope ?? "everyone"}
              options={[
                { value: "everyone", label: "Everyone" },
                { value: "friends_of_friends", label: "Friends of friends" },
              ]}
              onChange={(value) => savePrivacy.mutate({ friend_request_scope: value })}
            />
            <Toggle
              label="People can look you up by your email"
              checked={profile.data?.lookup_by_email ?? true}
              onChange={(checked) => savePrivacy.mutate({ lookup_by_email: checked })}
            />
            <Toggle
              label="People can look you up by your phone number"
              checked={profile.data?.lookup_by_phone ?? true}
              onChange={(checked) => savePrivacy.mutate({ lookup_by_phone: checked })}
            />
            <Toggle
              label="Share new profile pictures to the feed"
              checked={profile.data?.share_avatar_updates ?? true}
              onChange={(checked) => savePrivacy.mutate({ share_avatar_updates: checked })}
            />
          </Card>
        )}

        {section === "blocking" && (
          <BlockingSection
            userId={userId}
            blocked={blocked.data ?? []}
            loading={blocked.isLoading}
            onDone={() => queryClient.invalidateQueries({ queryKey: ["blocked", userId] })}
          />
        )}

        {section === "notifications" && (
          <Card title="Notifications">
            {prefs.isLoading && <Skeleton />}
            <Toggle
              label="Comments on your posts"
              checked={prefs.data?.on_comment ?? true}
              onChange={async (checked) => {
                await saveNotificationPrefs(userId, { on_comment: checked });
                queryClient.invalidateQueries({ queryKey: ["notif-prefs", userId] });
              }}
            />
            <Toggle
              label="Likes and reactions"
              checked={prefs.data?.on_like ?? true}
              onChange={async (checked) => {
                await saveNotificationPrefs(userId, { on_like: checked });
                queryClient.invalidateQueries({ queryKey: ["notif-prefs", userId] });
              }}
            />
            <Toggle
              label="Friend requests"
              checked={prefs.data?.on_friend_request ?? true}
              onChange={async (checked) => {
                await saveNotificationPrefs(userId, { on_friend_request: checked });
                queryClient.invalidateQueries({ queryKey: ["notif-prefs", userId] });
              }}
            />
            <Toggle
              label="New messages"
              checked={prefs.data?.on_message ?? true}
              onChange={async (checked) => {
                await saveNotificationPrefs(userId, { on_message: checked });
                queryClient.invalidateQueries({ queryKey: ["notif-prefs", userId] });
              }}
            />
          </Card>
        )}

        {section === "your-info" && (
          <YourInfoSection
            userId={userId}
            deactivated={Boolean(profile.data?.deactivated_at)}
            onSignedOut={() => navigate({ to: "/auth", replace: true })}
          />
        )}
      </div>
    </AppShell>
  );
}

/* ---------- sections ---------- */

function PersonalSection({
  userId,
  email,
  displayName,
  phone,
  birthday,
  gender,
  onDone,
}: {
  userId: string;
  email: string;
  displayName: string;
  phone: string;
  birthday: string;
  gender: string;
  onDone: () => void;
}) {
  const [form, setForm] = useState({ name: displayName, email, phone, birthday, gender, password: "" });
  useEffect(() => {
    setForm((current) => ({ ...current, name: displayName, email, phone, birthday, gender }));
  }, [displayName, email, phone, birthday, gender]);

  return (
    <Card title="Personal Information">
      <Field label="Name" value={form.name} onChange={(value) => setForm((c) => ({ ...c, name: value }))} />
      <Field label="Email" value={form.email} onChange={(value) => setForm((c) => ({ ...c, email: value }))} />
      <Field label="Phone number" value={form.phone} onChange={(value) => setForm((c) => ({ ...c, phone: value }))} />
      <Field
        label="Birthday"
        type="date"
        value={form.birthday}
        onChange={(value) => setForm((c) => ({ ...c, birthday: value }))}
      />
      <Field label="Gender" value={form.gender} onChange={(value) => setForm((c) => ({ ...c, gender: value }))} />
      <Field
        label="Current password (needed to confirm changes)"
        type="password"
        value={form.password}
        onChange={(value) => setForm((c) => ({ ...c, password: value }))}
      />
      <Action
        label="Save personal information"
        onClick={async () => {
          if (!form.password) throw new Error("Enter your current password to confirm");
          await reauthenticate(email, form.password);
          await updateProfile(userId, { display_name: form.name.trim() || "New member" });
          await savePrivateInfo(userId, {
            phone: form.phone.trim() || null,
            birthday: form.birthday || null,
            gender: form.gender.trim() || null,
          });
          if (form.email.trim() && form.email.trim() !== email) {
            await changeEmail(email, form.password, form.email.trim());
            toast.info("Check your new email to confirm the change.");
          }
          if (form.phone.trim()) {
            await changePhone(email, form.password, form.phone.trim()).catch(() => undefined);
          }
          setForm((c) => ({ ...c, password: "" }));
          onDone();
          toast.success("Personal information saved");
        }}
      />
    </Card>
  );
}

function SecuritySection({
  userId,
  email,
  twoFactorOn,
  devices,
  loadingDevices,
  onDone,
}: {
  userId: string;
  email: string;
  twoFactorOn: boolean;
  devices: { id: string; label: string; user_agent: string | null; last_seen_at: string; revoked_at: string | null }[];
  loadingDevices: boolean;
  onDone: () => void;
}) {
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [enroll, setEnroll] = useState<{ factorId: string; qr: string } | null>(null);
  const [code, setCode] = useState("");
  const thisDevice = currentDeviceId();

  return (
    <>
      <Card title="Change password">
        <Field
          label="Current password"
          type="password"
          value={pw.current}
          onChange={(value) => setPw((c) => ({ ...c, current: value }))}
        />
        <Field
          label="New password"
          type="password"
          value={pw.next}
          onChange={(value) => setPw((c) => ({ ...c, next: value }))}
        />
        <Field
          label="Confirm new password"
          type="password"
          value={pw.confirm}
          onChange={(value) => setPw((c) => ({ ...c, confirm: value }))}
        />
        <Action
          label="Update password"
          onClick={async () => {
            if (pw.next.length < 8) throw new Error("Use at least 8 characters");
            if (pw.next !== pw.confirm) throw new Error("The new passwords don't match");
            await changePassword(email, pw.current, pw.next);
            setPw({ current: "", next: "", confirm: "" });
            toast.success("Password updated");
          }}
        />
      </Card>

      <Card title="Two-factor authentication">
        <p className="text-xs text-ink-soft">
          {twoFactorOn
            ? "Two-factor authentication is on. You'll be asked for a code from your authenticator app."
            : "Add a second step at sign-in using an authenticator app."}
        </p>
        {twoFactorOn ? (
          <Action
            label="Turn off two-factor"
            onClick={async () => {
              await disableTwoFactor(userId);
              onDone();
              toast.success("Two-factor turned off");
            }}
          />
        ) : enroll ? (
          <div className="space-y-3">
            <img src={enroll.qr} alt="Two-factor QR code" className="size-40 rounded-xl bg-white p-2" />
            <Field label="6-digit code from your app" value={code} onChange={setCode} />
            <Action
              label="Confirm and turn on"
              onClick={async () => {
                await confirmTwoFactor(userId, enroll.factorId, code.trim());
                setEnroll(null);
                setCode("");
                onDone();
                toast.success("Two-factor is on");
              }}
            />
          </div>
        ) : (
          <Action
            label="Set up two-factor"
            onClick={async () => {
              const started = await startTwoFactor();
              setEnroll({ factorId: started.factorId, qr: started.qr });
            }}
          />
        )}
      </Card>

      <Card title="Where you're signed in">
        {loadingDevices && <Skeleton />}
        {!loadingDevices && devices.length === 0 && <EmptyNote>No devices recorded yet.</EmptyNote>}
        <ul className="space-y-2">
          {devices.map((device) => (
            <li key={device.id} className="flex items-center justify-between rounded-xl bg-bone-soft/70 p-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {device.label}
                  {device.id === thisDevice ? " · this device" : ""}
                </p>
                <p className="truncate text-[11px] text-ink-soft">
                  Last active {new Date(device.last_seen_at).toLocaleString()}
                  {device.revoked_at ? " · signed out" : ""}
                </p>
              </div>
              {!device.revoked_at && (
                <Action
                  small
                  label="Log out"
                  onClick={async () => {
                    await revokeDevice(device.id);
                    onDone();
                    toast.success("Device signed out");
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

function BlockingSection({
  userId,
  blocked,
  loading,
  onDone,
}: {
  userId: string;
  blocked: {
    id: string;
    blocked_id: string;
    blocked: { id: string; display_name: string; avatar_url: string | null } | null;
  }[];
  loading: boolean;
  onDone: () => void;
}) {
  const [term, setTerm] = useState("");
  const results = useQuery({
    queryKey: ["block-search", term],
    queryFn: () => globalSearch(term),
    enabled: term.trim().length > 1,
  });

  return (
    <Card title="Blocking">
      <Field label="Find someone to block" value={term} onChange={setTerm} />
      <ul className="space-y-1">
        {(results.data?.people ?? [])
          .filter((person) => person.id !== userId)
          .map((person) => (
            <li key={person.id} className="flex items-center justify-between rounded-xl bg-bone-soft/70 p-2">
              <span className="flex items-center gap-2">
                <UserAvatar name={person.display_name} src={person.avatar_url} className="size-8" />
                <span className="text-sm font-medium">{person.display_name}</span>
              </span>
              <Action
                small
                label="Block"
                onClick={async () => {
                  await blockUser(userId, person.id);
                  setTerm("");
                  onDone();
                  toast.success("Blocked");
                }}
              />
            </li>
          ))}
      </ul>

      <h3 className="font-display pt-2 text-[11px] font-semibold tracking-wide text-ink-soft uppercase">
        Block list
      </h3>
      {loading && <Skeleton />}
      {!loading && blocked.length === 0 && <EmptyNote>You haven't blocked anyone.</EmptyNote>}
      <ul className="space-y-2">
        {blocked.map((entry) => (
          <li key={entry.id} className="flex items-center justify-between rounded-xl bg-bone-soft/70 p-3">
            <span className="flex items-center gap-2">
              <UserAvatar
                name={entry.blocked?.display_name ?? "Member"}
                src={entry.blocked?.avatar_url}
                className="size-8"
              />
              <span className="text-sm font-medium">{entry.blocked?.display_name ?? "Member"}</span>
            </span>
            <Action
              small
              label="Unblock"
              onClick={async () => {
                await unblockUser(entry.id);
                onDone();
              }}
            />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function YourInfoSection({
  userId,
  deactivated,
  onSignedOut,
}: {
  userId: string;
  deactivated: boolean;
  onSignedOut: () => void;
}) {
  const queryClient = useQueryClient();
  const [confirmStep, setConfirmStep] = useState<"none" | "deactivate" | "delete">("none");

  return (
    <>
      <Card title="Download Your Information">
        <p className="text-xs text-ink-soft">
          Get a copy of your profile, posts, comments, about details, photos list, preferences and
          devices as a single file.
        </p>
        <Action
          label="Download my information"
          onClick={async () => {
            const data = await exportAccountData(userId);
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `flowtext-my-information-${new Date().toISOString().slice(0, 10)}.json`;
            link.click();
            URL.revokeObjectURL(url);
            toast.success("Your file is downloading");
          }}
        />
      </Card>

      <Card title="Deactivate Account">
        <p className="text-xs text-ink-soft">
          Deactivating hides your profile, posts and photos from everyone else. Nothing is deleted —
          sign back in any time to bring it all back.
        </p>
        {deactivated ? (
          <EmptyNote>Your account is currently deactivated.</EmptyNote>
        ) : confirmStep === "deactivate" ? (
          <div className="flex flex-wrap gap-2">
            <Action
              label="Yes, deactivate and sign out"
              onClick={async () => {
                await deactivateAccount(userId);
                queryClient.clear();
                onSignedOut();
              }}
            />
            <button
              onClick={() => setConfirmStep("none")}
              className="font-display rounded-full px-4 py-2 text-xs font-semibold text-ink-soft ring-1 ring-ink/15"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmStep("deactivate")}
            className="font-display rounded-full px-5 py-2 text-xs font-semibold text-ink-soft ring-1 ring-ink/15 hover:bg-bone-soft"
          >
            Deactivate account
          </button>
        )}
      </Card>

      <Card title="Delete Account">
        <p className="text-xs text-ink-soft">
          Deleting is permanent. Your profile, posts, comments, messages, about details and uploaded
          photos and videos are removed and cannot be recovered.
        </p>
        {confirmStep === "delete" ? (
          <div className="flex flex-wrap gap-2">
            <Action
              label="Permanently delete everything"
              onClick={async () => {
                await deleteMyAccount({ data: undefined });
                await supabase.auth.signOut();
                queryClient.clear();
                onSignedOut();
              }}
            />
            <button
              onClick={() => setConfirmStep("none")}
              className="font-display rounded-full px-4 py-2 text-xs font-semibold text-ink-soft ring-1 ring-ink/15"
            >
              Keep my account
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmStep("delete")}
            className="font-display rounded-full bg-clay px-5 py-2 text-xs font-semibold text-bone hover:bg-clay-deep"
          >
            Delete account
          </button>
        )}
      </Card>
    </>
  );
}

/* ---------- small pieces ---------- */

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl bg-card p-5 ring-1 ring-black/5">
      <h2 className="font-display text-sm font-bold tracking-wide uppercase">{title}</h2>
      {children}
    </section>
  );
}

function Skeleton() {
  return <div className="h-14 animate-pulse rounded-xl bg-bone-soft" />;
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="font-display text-[11px] font-semibold tracking-wide text-ink-soft uppercase">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        {...(type === "password" ? { "data-osk-off": "" } : {})}
        className="mt-1 w-full rounded-xl bg-bone-soft px-3 py-2 text-sm outline-none ring-1 ring-ink/10 focus:ring-teal/40"
      />
    </label>
  );
}

function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <p className="font-display text-[11px] font-semibold tracking-wide text-ink-soft uppercase">
        {label}
      </p>
      <div className="font-display mt-1 flex flex-wrap gap-1 text-xs font-semibold">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={
              value === option.value
                ? "rounded-full bg-teal px-3 py-1.5 text-bone"
                : "rounded-full px-3 py-1.5 text-ink-soft ring-1 ring-ink/10 hover:bg-bone-soft"
            }
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void | Promise<void>;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl bg-bone-soft/70 px-3 py-2">
      <span className="text-sm">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => void onChange(event.target.checked)}
        className="size-4"
      />
    </label>
  );
}

function Action({
  label,
  onClick,
  small,
}: {
  label: string;
  onClick: () => Promise<void>;
  small?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      onClick={async () => {
        setBusy(true);
        try {
          await onClick();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Something went wrong");
        } finally {
          setBusy(false);
        }
      }}
      disabled={busy}
      className={
        small
          ? "font-display shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold text-clay-deep ring-1 ring-clay/30 hover:bg-clay hover:text-bone disabled:opacity-50"
          : "font-display rounded-full bg-clay px-5 py-2 text-xs font-semibold text-bone hover:bg-clay-deep disabled:opacity-50"
      }
    >
      {busy ? "Working…" : label}
    </button>
  );
}
