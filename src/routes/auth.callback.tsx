import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Wordmark } from "@/components/flowtext/Wordmark";

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Confirming your account — FlowText" },
      {
        name: "description",
        content: "Finishing your FlowText account confirmation and signing you in.",
      },
      { property: "og:title", content: "Confirming your account — FlowText" },
      { property: "og:description", content: "Finishing your FlowText account confirmation." },
    ],
  }),
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function finish() {
      try {
        const url = new URL(window.location.href);
        const params = url.searchParams;
        const hash = new URLSearchParams(url.hash.replace(/^#/, ""));

        const tokenHash = params.get("token_hash");
        const type = params.get("type");
        const code = params.get("code");
        const errorDescription =
          params.get("error_description") ?? hash.get("error_description") ?? null;

        if (errorDescription) throw new Error(errorDescription);

        if (tokenHash && type) {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as "signup" | "email" | "recovery" | "magiclink" | "invite",
          });
          if (verifyError) throw verifyError;
        } else if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        }

        // Wait briefly for the session to land (implicit links set it from the hash).
        for (let attempt = 0; attempt < 20; attempt += 1) {
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            if (!cancelled) navigate({ to: "/feed", replace: true });
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, 250));
        }

        if (!cancelled) navigate({ to: "/auth", replace: true });
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : "That confirmation link is no longer valid.",
          );
        }
      }
    }

    void finish();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bone px-6 text-center text-ink">
      <Wordmark className="text-3xl" />
      {error ? (
        <>
          <p className="max-w-sm text-sm text-ink-soft">{error}</p>
          <button
            type="button"
            onClick={() => navigate({ to: "/auth" })}
            className="font-display rounded-full bg-clay px-4 py-2 text-sm font-semibold text-bone hover:bg-clay-deep"
          >
            Back to sign in
          </button>
        </>
      ) : (
        <p className="text-sm text-ink-soft">Confirming your account…</p>
      )}
    </div>
  );
}
