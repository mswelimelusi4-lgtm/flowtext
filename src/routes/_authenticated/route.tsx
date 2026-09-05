import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { registerDevice } from "@/lib/profile";
import { ensureProfile } from "@/lib/session";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    await ensureProfile(data.user);
    void registerDevice(data.user.id);
    return { user: data.user, userId: data.user.id };
  },
  component: () => <Outlet />,
});
