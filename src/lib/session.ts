import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/** Client-side session state. The route gate handles redirects. */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, user: session?.user ?? null, loading };
}

export type { User };

export type PendingSignup = {
  firstName: string;
  surname: string;
  birthday: string;
  gender: string;
  genderCustom?: string;
  phone?: string;
  email?: string;
};

const PENDING_KEY = "flowtext-pending-signup";

export function savePendingSignup(details: PendingSignup) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(details));
  } catch {
    /* storage unavailable */
  }
}

function readPendingSignup(): PendingSignup | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as PendingSignup) : null;
  } catch {
    return null;
  }
}

export function clearPendingSignup() {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    /* storage unavailable */
  }
}

/** Makes sure a profile row exists for the signed-in user. */
export async function ensureProfile(user: User) {
  const pending = readPendingSignup();
  const { data } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();

  const fallbackName =
    (pending && `${pending.firstName} ${pending.surname}`.trim()) ||
    (user.user_metadata?.["full_name"] as string | undefined) ||
    (user.user_metadata?.["name"] as string | undefined) ||
    user.email?.split("@")[0] ||
    "New member";

  if (!data) {
    await supabase.from("profiles").insert({
      id: user.id,
      display_name: fallbackName,
      avatar_url: (user.user_metadata?.["avatar_url"] as string | undefined) ?? null,
      ...(pending
        ? {
            first_name: pending.firstName,
            surname: pending.surname,
            birthday: pending.birthday,
            gender: pending.gender,
            gender_custom: pending.genderCustom ?? null,
          }
        : {}),
    });
  } else if (pending) {
    await supabase
      .from("profiles")
      .update({
        display_name: fallbackName,
        first_name: pending.firstName,
        surname: pending.surname,
        birthday: pending.birthday,
        gender: pending.gender,
        gender_custom: pending.genderCustom ?? null,
      })
      .eq("id", user.id);
  }

  if (pending) {
    await supabase.from("profile_private").upsert(
      {
        user_id: user.id,
        birthday: pending.birthday,
        gender: pending.gender === "custom" ? (pending.genderCustom ?? "custom") : pending.gender,
        ...(pending.phone ? { phone: pending.phone } : {}),
        ...(pending.email ? { contact_email: pending.email } : {}),
      },
      { onConflict: "user_id" },
    );
    clearPendingSignup();
  }
}

