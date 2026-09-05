import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Wordmark } from "@/components/flowtext/Wordmark";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in to FlowText — join the current" },
      {
        name: "description",
        content:
          "Create a FlowText account or sign in to share posts, join groups, and message your people.",
      },
      { property: "og:title", content: "Sign in to FlowText" },
      { property: "og:description", content: "Sign in or create your FlowText account." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        if (!data.session) {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (signInError) {
            setSent(true);
            return;
          }
        }
        navigate({ to: "/" });
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!remember) sessionStorage.setItem("flowtext-session-only", "1");
      navigate({ to: "/feed" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google sign-in isn't available right now.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/feed" });
  }

  return (
    <div className="min-h-screen bg-bone text-ink">
      <div className="chrome-bar h-1.5 w-full" />
      <div className="mx-auto grid min-h-[calc(100vh-6px)] max-w-5xl items-center gap-10 px-5 py-12 md:grid-cols-2">
        <div>
          <Link to="/">
            <Wordmark className="text-4xl" />
          </Link>
          <h1 className="font-display mt-6 text-3xl leading-tight font-bold text-balance">
            Your people, one continuous current.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            Post text, photos and video. Thread comments. Keep group chats and private messages
            flowing in one place.
          </p>
        </div>

        <div className="rounded-2xl bg-card p-6 ring-1 ring-black/5">
          {sent ? (
            <div>
              <h2 className="font-display text-lg font-semibold">Check your email</h2>
              <p className="mt-2 text-sm text-ink-soft">
                We sent a confirmation link to {email}. Click it and you'll be signed in.
              </p>
            </div>
          ) : (
            <>
              <div className="font-display flex gap-2">
                {(["signin", "signup"] as const).map((option) => (
                  <button
                    key={option}
                    onClick={() => setMode(option)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-semibold",
                      mode === option ? "bg-ink text-bone" : "text-ink-soft ring-1 ring-ink/10",
                    )}
                  >
                    {option === "signin" ? "Sign in" : "Create account"}
                  </button>
                ))}
              </div>

              <form onSubmit={submit} className="mt-5 space-y-3">
                {mode === "signup" && (
                  <Field label="Display name" value={name} onChange={setName} placeholder="Ada Flow" />
                )}
                <Field
                  label="Email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="you@example.com"
                  required
                />
                <Field
                  label="Password"
                  type="password"
                  value={password}
                  onChange={setPassword}
                  placeholder="At least 6 characters"
                  required
                />

                {mode === "signin" && (
                  <label className="flex items-center gap-2 text-xs text-ink-soft">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(event) => setRemember(event.target.checked)}
                      className="accent-teal"
                    />
                    Keep me signed in on this device
                  </label>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="font-display w-full rounded-full bg-clay px-4 py-2.5 text-sm font-semibold text-bone hover:bg-clay-deep disabled:opacity-50"
                >
                  {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
                </button>
              </form>

              <div className="my-4 flex items-center gap-3 text-[11px] text-ink-soft">
                <span className="h-px flex-1 bg-ink/10" />
                or
                <span className="h-px flex-1 bg-ink/10" />
              </div>

              <button
                onClick={google}
                className="font-display w-full rounded-full px-4 py-2.5 text-sm font-semibold text-ink ring-1 ring-ink/15 hover:bg-bone-soft"
              >
                Continue with Google
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="font-display text-[11px] font-semibold tracking-wide text-ink-soft uppercase">
        {label}
      </span>
      <input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-xl bg-bone-soft px-3 py-2 text-sm outline-none ring-1 ring-ink/10 focus:ring-teal/40"
      />
    </label>
  );
}
