import { createFileRoute } from "@tanstack/react-router";
import { Shield } from "lucide-react";
import { RoleLoginPage } from "@/components/RoleLoginPage";

export const Route = createFileRoute("/login/manager")({
  ssr: false,
  component: () => (
    <RoleLoginPage
      theme={{
        role: "manager",
        title: "AAI Manager Portal",
        subtitle: "Asset Management System",
        badge: "Manager Access",
        badgeIcon: Shield,
        accentFrom: "from-electric",
        accentTo: "to-cyan-glow",
        ring: "focus:ring-cyan-glow/40",
        border: "border-cyan-glow/40",
        glow: "shadow-cyan-glow/20",
        text: "text-cyan-glow",
        bgOrb1: "bg-electric/25",
        bgOrb2: "bg-cyan-glow/20",
        backdrop: "grid",
      }}
    />
  ),
});
