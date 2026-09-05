import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Permanently deletes the signed-in account: their rows (removed by cascade
 * from the profile), their uploaded files, and the auth user itself.
 * The caller can only ever delete themselves — the id comes from the token.
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: files } = await supabaseAdmin.storage.from("media").list(userId, { limit: 1000 });
    if (files && files.length > 0) {
      await supabaseAdmin.storage.from("media").remove(files.map((file) => `${userId}/${file.name}`));
    }

    // Profile rows cascade to experiences, places, family, life events,
    // photos, private info, prefs, devices, posts, comments and reactions.
    await supabaseAdmin.from("profiles").delete().eq("id", userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });
