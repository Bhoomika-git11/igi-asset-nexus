import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // getSession reads from localStorage — synchronous-fast, no network round-trip.
    // Using getUser() here caused a network fetch on every navigation, which made
    // the router show a pending state and users perceived it as needing "two clicks".
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" });
  },
  component: () => <AppShell><Outlet /></AppShell>,
});
