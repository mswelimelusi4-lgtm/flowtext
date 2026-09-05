import { supabase } from "@/integrations/supabase/client";

/* ---------- types ---------- */

export type Experience = {
  id: string;
  user_id: string;
  kind: "work" | "school";
  title: string | null;
  organization: string;
  degree: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  description: string | null;
};

export type Place = {
  id: string;
  user_id: string;
  kind: "current" | "hometown" | "other";
  name: string;
  year: number | null;
};

export type FamilyMember = {
  id: string;
  user_id: string;
  relative_id: string;
  relationship: string;
  relative: { id: string; display_name: string; avatar_url: string | null } | null;
};

export type LifeEvent = {
  id: string;
  user_id: string;
  title: string;
  event_date: string;
  description: string | null;
  photo_url: string | null;
};

export type ProfilePhoto = {
  id: string;
  user_id: string;
  kind: "avatar" | "cover";
  url: string;
  created_at: string;
};

export type PrivateInfo = {
  user_id: string;
  phone: string | null;
  contact_email: string | null;
  birthday: string | null;
  gender: string | null;
  languages: string[];
};

export type DeliveryMethod = "push" | "email" | "none";

export type NotificationPrefs = {
  user_id: string;
  on_comment: boolean;
  on_like: boolean;
  on_friend_request: boolean;
  on_message: boolean;
  on_group_activity: boolean;
  on_reminder: boolean;
  delivery_like: DeliveryMethod;
  delivery_comment: DeliveryMethod;
  delivery_friend_request: DeliveryMethod;
  delivery_message: DeliveryMethod;
  delivery_group_activity: DeliveryMethod;
};


export type Device = {
  id: string;
  label: string;
  user_agent: string | null;
  last_seen_at: string;
  revoked_at: string | null;
};

export const RELATIONSHIP_STATUSES = [
  "Single",
  "In a relationship",
  "Engaged",
  "Married",
  "It's complicated",
  "In an open relationship",
  "Separated",
  "Divorced",
  "Widowed",
] as const;

export const FAMILY_RELATIONSHIPS = [
  "Parent",
  "Sibling",
  "Spouse",
  "Partner",
  "Child",
  "Cousin",
  "Grandparent",
  "Other",
] as const;

export const AUDIENCES = [
  { value: "public", label: "Public" },
  { value: "friends", label: "Friends" },
  { value: "private", label: "Only me" },
] as const;

function done(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

/* ---------- work & education ---------- */

export async function fetchExperiences(userId: string) {
  const { data, error } = await supabase
    .from("profile_experiences")
    .select("*")
    .eq("user_id", userId)
    .order("start_date", { ascending: false, nullsFirst: false });
  done(error);
  return (data ?? []) as unknown as Experience[];
}

export async function addExperience(input: Omit<Experience, "id">) {
  const { error } = await supabase.from("profile_experiences").insert(input);
  done(error);
}

export async function updateExperience(id: string, patch: Partial<Experience>) {
  const { error } = await supabase.from("profile_experiences").update(patch).eq("id", id);
  done(error);
}

export async function removeExperience(id: string) {
  const { error } = await supabase.from("profile_experiences").delete().eq("id", id);
  done(error);
}

/* ---------- places lived ---------- */

export async function fetchPlaces(userId: string) {
  const { data, error } = await supabase
    .from("profile_places")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  done(error);
  return (data ?? []) as unknown as Place[];
}

export async function addPlace(input: Omit<Place, "id">) {
  const { error } = await supabase.from("profile_places").insert(input);
  done(error);
}

export async function removePlace(id: string) {
  const { error } = await supabase.from("profile_places").delete().eq("id", id);
  done(error);
}

/* ---------- family ---------- */

export async function fetchFamily(userId: string) {
  const { data, error } = await supabase
    .from("family_members")
    .select("id, user_id, relative_id, relationship, relative:profiles!family_members_relative_id_fkey(id, display_name, avatar_url)")
    .eq("user_id", userId);
  done(error);
  return (data ?? []) as unknown as FamilyMember[];
}

export async function addFamilyMember(userId: string, relativeId: string, relationship: string) {
  const { error } = await supabase
    .from("family_members")
    .insert({ user_id: userId, relative_id: relativeId, relationship });
  done(error);
}

export async function removeFamilyMember(id: string) {
  const { error } = await supabase.from("family_members").delete().eq("id", id);
  done(error);
}

/* ---------- life events ---------- */

export async function fetchLifeEvents(userId: string) {
  const { data, error } = await supabase
    .from("life_events")
    .select("*")
    .eq("user_id", userId)
    .order("event_date", { ascending: false });
  done(error);
  return (data ?? []) as unknown as LifeEvent[];
}

export async function addLifeEvent(input: Omit<LifeEvent, "id">) {
  const { error } = await supabase.from("life_events").insert(input);
  done(error);
}

export async function removeLifeEvent(id: string) {
  const { error } = await supabase.from("life_events").delete().eq("id", id);
  done(error);
}

/* ---------- photo history ---------- */

export async function fetchProfilePhotos(userId: string, kind?: "avatar" | "cover") {
  let query = supabase
    .from("profile_photos")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (kind) query = query.eq("kind", kind);
  const { data, error } = await query;
  done(error);
  return (data ?? []) as unknown as ProfilePhoto[];
}

export async function recordProfilePhoto(userId: string, kind: "avatar" | "cover", url: string) {
  const { error } = await supabase.from("profile_photos").insert({ user_id: userId, kind, url });
  done(error);
}

/* ---------- private info (owner only, enforced by RLS) ---------- */

export async function fetchPrivateInfo(userId: string) {
  const { data, error } = await supabase
    .from("profile_private")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  done(error);
  return (data ?? null) as PrivateInfo | null;
}

export async function savePrivateInfo(userId: string, patch: Partial<PrivateInfo>) {
  const { error } = await supabase
    .from("profile_private")
    .upsert({ user_id: userId, ...patch }, { onConflict: "user_id" });
  done(error);
}

/* ---------- notification preferences ---------- */

export async function fetchNotificationPrefs(userId: string) {
  const { data, error } = await supabase
    .from("notification_prefs")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  done(error);
  const fallback: NotificationPrefs = {
    user_id: userId,
    on_comment: true,
    on_like: true,
    on_friend_request: true,
    on_message: true,
    on_group_activity: true,
    on_reminder: true,
    delivery_like: "push",
    delivery_comment: "push",
    delivery_friend_request: "push",
    delivery_message: "push",
    delivery_group_activity: "push",
  };
  return (data as NotificationPrefs | null) ?? fallback;

}

export async function saveNotificationPrefs(userId: string, patch: Partial<NotificationPrefs>) {
  const { error } = await supabase
    .from("notification_prefs")
    .upsert({ user_id: userId, ...patch }, { onConflict: "user_id" });
  done(error);
}

/* ---------- blocking ---------- */

export async function fetchBlocked(userId: string) {
  const { data, error } = await supabase
    .from("blocked_users")
    .select("id, blocked_id, created_at, blocked:profiles!blocked_users_blocked_id_fkey(id, display_name, avatar_url)")
    .eq("blocker_id", userId);
  done(error);
  return (data ?? []) as unknown as {
    id: string;
    blocked_id: string;
    created_at: string;
    blocked: { id: string; display_name: string; avatar_url: string | null } | null;
  }[];
}

export async function blockUser(userId: string, blockedId: string) {
  const { error } = await supabase
    .from("blocked_users")
    .insert({ blocker_id: userId, blocked_id: blockedId });
  done(error);
}

export async function unblockUser(id: string) {
  const { error } = await supabase.from("blocked_users").delete().eq("id", id);
  done(error);
}

/* ---------- devices ---------- */

export async function registerDevice(userId: string) {
  if (typeof window === "undefined") return;
  const key = "flowtext.device";
  const stored = window.localStorage.getItem(key);
  const ua = window.navigator.userAgent;
  const label = /iphone|android|ipad|mobile/i.test(ua) ? "Mobile browser" : "Desktop browser";
  if (stored) {
    await supabase
      .from("user_devices")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", stored)
      .eq("user_id", userId);
    return;
  }
  const { data } = await supabase
    .from("user_devices")
    .insert({ user_id: userId, label, user_agent: ua })
    .select("id")
    .maybeSingle();
  if (data?.id) window.localStorage.setItem(key, data.id);
}

export function currentDeviceId() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("flowtext.device");
}

export async function fetchDevices(userId: string) {
  const { data, error } = await supabase
    .from("user_devices")
    .select("id, label, user_agent, last_seen_at, revoked_at")
    .eq("user_id", userId)
    .order("last_seen_at", { ascending: false });
  done(error);
  return (data ?? []) as Device[];
}

/** Marks a device signed out. If it's this device, ends the session too. */
export async function revokeDevice(id: string) {
  const { error } = await supabase
    .from("user_devices")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);
  done(error);
  if (id === currentDeviceId()) await supabase.auth.signOut();
}

/* ---------- security: always through Supabase auth ---------- */

export async function reauthenticate(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error("That password doesn't match your account.");
}

export async function changePassword(email: string, currentPassword: string, newPassword: string) {
  await reauthenticate(email, currentPassword);
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  done(error);
}

export async function changeEmail(currentEmail: string, password: string, newEmail: string) {
  await reauthenticate(currentEmail, password);
  const { error } = await supabase.auth.updateUser({ email: newEmail });
  done(error);
}

export async function changePhone(email: string, password: string, phone: string) {
  await reauthenticate(email, password);
  const { error } = await supabase.auth.updateUser({ phone });
  done(error);
}

export async function startTwoFactor() {
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
  if (error) throw new Error(error.message);
  return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

export async function confirmTwoFactor(userId: string, factorId: string, code: string) {
  const challenge = await supabase.auth.mfa.challenge({ factorId });
  if (challenge.error) throw new Error(challenge.error.message);
  const { error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.data.id,
    code,
  });
  if (error) throw new Error(error.message);
  await supabase.from("profiles").update({ two_factor_enabled: true }).eq("id", userId);
}

export async function disableTwoFactor(userId: string) {
  const { data } = await supabase.auth.mfa.listFactors();
  for (const factor of data?.totp ?? []) {
    await supabase.auth.mfa.unenroll({ factorId: factor.id });
  }
  await supabase.from("profiles").update({ two_factor_enabled: false }).eq("id", userId);
}

/* ---------- account lifecycle ---------- */

export async function deactivateAccount(userId: string) {
  const { error } = await supabase
    .from("profiles")
    .update({ deactivated_at: new Date().toISOString() })
    .eq("id", userId);
  done(error);
  await supabase.auth.signOut();
}

export async function reactivateAccount(userId: string) {
  const { error } = await supabase.from("profiles").update({ deactivated_at: null }).eq("id", userId);
  done(error);
}

/** Collects everything this account owns, for the download-your-information export. */
export async function exportAccountData(userId: string) {
  const [profile, priv, posts, comments, experiences, places, family, events, photos, prefs, blocked, devices] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("profile_private").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("posts").select("*").eq("author_id", userId),
      supabase.from("comments").select("*").eq("author_id", userId),
      supabase.from("profile_experiences").select("*").eq("user_id", userId),
      supabase.from("profile_places").select("*").eq("user_id", userId),
      supabase.from("family_members").select("*").eq("user_id", userId),
      supabase.from("life_events").select("*").eq("user_id", userId),
      supabase.from("profile_photos").select("*").eq("user_id", userId),
      supabase.from("notification_prefs").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("blocked_users").select("*").eq("blocker_id", userId),
      supabase.from("user_devices").select("*").eq("user_id", userId),
    ]);

  return {
    exported_at: new Date().toISOString(),
    profile: profile.data,
    contact_and_basic_info: priv.data,
    posts: posts.data ?? [],
    comments: comments.data ?? [],
    work_and_education: experiences.data ?? [],
    places_lived: places.data ?? [],
    family_members: family.data ?? [],
    life_events: events.data ?? [],
    profile_photos: photos.data ?? [],
    notification_preferences: prefs.data,
    blocked_people: blocked.data ?? [],
    devices: devices.data ?? [],
  };
}
