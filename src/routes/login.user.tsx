import { createFileRoute } from "@tanstack/react-router";
import { User } from "lucide-react";
import { RoleLoginPage } from "@/components/RoleLoginPage";

export const Route = createFileRoute("/login/user")({
  ssr: false,
  component: () => (
    <RoleLoginPage
      theme={{
        role: "user",
        title: "AAI Staff Portal",
        subtitle: "View Your Assigned Assets",
        badge: "Staff Access",
        badgeIcon: User,
        accentFrom: "from-emerald-500",
        accentTo: "to-teal-300",
        ring: "focus:ring-emerald-500/40",
        border: "border-emerald-500/40",
        glow: "shadow-emerald-500/20",
        text: "text-emerald-300",
        bgOrb1: "bg-emerald-500/20",
        bgOrb2: "bg-teal-400/15",
        emailLabel: "Employee ID or Email",
        emailPlaceholder: "employee@aai.aero",
        backdrop: "particles",
      }}
    />
  ),
});
