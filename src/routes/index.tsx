import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { ShieldAlert, Shield, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AAILogo } from "@/components/AAILogo";
import { ParticleField } from "@/components/ParticleField";

export const Route = createFileRoute("/")({
  ssr: false,
  component: LandingPage,
});

function LandingPage() {
  const nav = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) nav({ to: "/dashboard", replace: true });
    });
  }, [nav]);

  const roles = [
    {
      to: "/login/admin",
      title: "Admin Login",
      desc: "Full system control & approvals",
      icon: ShieldAlert,
      grad: "from-red-500 to-amber-400",
      border: "border-red-500/40",
      text: "text-amber-300",
      glow: "hover:shadow-red-500/30",
    },
    {
      to: "/login/manager",
      title: "Manager Login",
      desc: "Manage inventory · request changes",
      icon: Shield,
      grad: "from-electric to-cyan-glow",
      border: "border-cyan-glow/40",
      text: "text-cyan-glow",
      glow: "hover:shadow-cyan-glow/30",
    },
    {
      to: "/login/user",
      title: "Staff Login",
      desc: "View your assigned assets",
      icon: User,
      grad: "from-emerald-500 to-teal-300",
      border: "border-emerald-500/40",
      text: "text-emerald-300",
      glow: "hover:shadow-emerald-500/30",
    },
  ] as const;

  return (
    <div className="relative min-h-screen overflow-hidden">
      <ParticleField />
      <div className="absolute inset-0 grid-bg opacity-30" />
      <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-electric/15 blur-3xl" />
      <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full bg-cyan-glow/15 blur-3xl" />

      <div className="absolute top-6 left-6 z-20 flex items-center gap-3">
        <AAILogo className="w-12 h-12" />
        <div>
          <div className="text-sm font-bold leading-tight">Airports Authority</div>
          <div className="text-[10px] uppercase tracking-widest text-cyan-glow">of India</div>
        </div>
      </div>

      <main className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-24">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-14 max-w-2xl"
        >
          <h1 className="text-4xl sm:text-5xl font-bold text-glow tracking-tight">
            IT Asset Command Center
          </h1>
          <p className="mt-4 text-cyan-glow/80 text-sm uppercase tracking-[0.3em]">
            Airports Authority of India · Indira Gandhi International
          </p>
          <p className="mt-6 text-muted-foreground text-sm">
            Choose your access level to sign in to the portal.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl">
          {roles.map((r, i) => {
            const Icon = r.icon;
            return (
              <motion.div
                key={r.to}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * i, duration: 0.4 }}
              >
                <Link
                  to={r.to}
                  className={`group block glass-strong rounded-2xl p-8 border ${r.border} transition-all hover:-translate-y-1 hover:shadow-2xl ${r.glow}`}
                >
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${r.grad} flex items-center justify-center text-navy-deep shadow-lg mb-5`}>
                    <Icon className="w-7 h-7" />
                  </div>
                  <div className={`text-xl font-bold mb-1 ${r.text}`}>{r.title}</div>
                  <div className="text-sm text-muted-foreground">{r.desc}</div>
                  <div className="mt-6 text-xs uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition">
                    Continue →
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>

        <p className="mt-16 text-[11px] text-muted-foreground text-center max-w-md">
          All accounts share the same credentials. Choose the portal that matches your role.
          <br />New accounts are provisioned by AAI IT administration.
        </p>
      </main>
    </div>
  );
}
