import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Generates birthday reminder notifications for the signed-in user.
 * Runs server-side because the underlying database function is locked down —
 * the user id always comes from the verified session, never the client.
 */
export const ensureBirthdayRemindersFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.rpc("ensure_birthday_reminders", { _for_user: context.userId });
    return { ok: true };
  });
