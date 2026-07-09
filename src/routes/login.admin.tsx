import { createFileRoute } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { RoleLoginPage } from "@/components/RoleLoginPage";

export const Route = createFileRoute("/login/admin")({
  ssr: false,
  component: () => (
    <RoleLoginPage
      theme={{
        role: "admin",
        title: "AAI Admin Portal",
        subtitle: "Restricted Access — Authorized Personnel Only",
        badge: "Admin Control Center",
        badgeIcon: ShieldAlert,
        accentFrom: "from-red-500",
        accentTo: "to-amber-400",
        ring: "focus:ring-red-500/40",
        border: "border-red-500/40",
        glow: "shadow-red-500/20",
        text: "text-amber-300",
        bgOrb1: "bg-red-500/20",
        bgOrb2: "bg-amber-400/15",
        backdrop: "globe",
      }}
    />
  ),
});
