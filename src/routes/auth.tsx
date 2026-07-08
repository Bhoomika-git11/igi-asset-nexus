import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Lock, Mail, Loader2, ShieldCheck, Plane } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ParticleField } from "@/components/ParticleField";
import { AAILogo } from "@/components/AAILogo";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) nav({ to: "/dashboard", replace: true });
    });
  }, [nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Access granted");
      nav({ to: "/dashboard", replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      toast.error(msg);
    } finally { setLoading(false); }
  };


  return (
    <div className="relative min-h-screen overflow-hidden flex items-center justify-center px-4">
      {/* Top-left brand */}
      <div className="absolute top-6 left-6 z-20 flex items-center gap-3">
        <AAILogo className="w-12 h-12" />
        <div>
          <div className="text-sm font-bold leading-tight">Airports Authority</div>
          <div className="text-[10px] uppercase tracking-widest text-cyan-glow">of India</div>
        </div>
      </div>

      {/* Backdrop */}
      <div className="absolute inset-0 grid-bg opacity-40" />
      <ParticleField />
      <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-electric/20 blur-3xl" />
      <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full bg-cyan-glow/20 blur-3xl" />

      <div className="relative z-10 grid md:grid-cols-2 gap-16 items-center max-w-6xl w-full">
        {/* 3D Globe scene */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="hidden md:flex flex-col items-center gap-8"
        >
          <div className="globe-scene relative flex items-center justify-center h-[460px] w-[460px]">
            {/* Pulsing aura */}
            <div className="globe-pulse" />
            {/* Extra glowing orbital arcs */}
            <div className="arc-line" style={{ inset: "-20px", transform: "rotate(15deg)" }} />
            <div className="arc-line" style={{ inset: "-45px", transform: "rotate(-25deg)" }} />
            <div className="arc-line" style={{ inset: "-75px", transform: "rotate(55deg)" }} />
            <div className="arc-line" style={{ inset: "-105px", transform: "rotate(-70deg)" }} />
            <div className="globe-ring-2" />
            <div className="globe-ring" />
            <div className="globe" />

            {/* Airplane in circular orbit */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="animate-plane-orbit">
                <Plane className="w-8 h-8 text-cyan-glow drop-shadow-[0_0_12px_oklch(0.82_0.17_200)]" style={{ transform: "rotate(90deg)" }} />
              </div>
            </div>
          </div>
          <div className="text-center">
            <motion.h1
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="text-4xl font-bold text-glow tracking-tight"
            >
              Airports Authority of India
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
              className="mt-3 text-cyan-glow/80 text-sm uppercase tracking-[0.3em]"
            >
              IT Asset Command Center
            </motion.p>
          </div>
        </motion.div>

        {/* Login card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="glass-strong rounded-3xl p-10 relative"
        >
          <div className="absolute -top-4 -right-4 px-3 py-1 rounded-full bg-cyan-glow/20 border border-cyan-glow/40 text-[10px] uppercase tracking-widest text-cyan-glow flex items-center gap-1.5">
            <ShieldCheck className="w-3 h-3" /> Secure Access
          </div>
          <h2 className="text-3xl font-bold mb-1">Sign in</h2>
          <p className="text-sm text-muted-foreground mb-8">
            Authenticate to access the asset portal.
          </p>

          <form onSubmit={submit} className="space-y-4">
            <Field icon={<Mail className="w-4 h-4" />} type="email" label="Email" value={email} onChange={setEmail} placeholder="you@aai.aero" required />
            <Field icon={<Lock className="w-4 h-4" />} type="password" label="Password" value={password} onChange={setPassword} placeholder="••••••••" required minLength={6} />

            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              disabled={loading}
              className="w-full mt-2 rounded-xl bg-gradient-to-r from-electric to-cyan-glow text-navy-deep font-semibold py-3.5 flex items-center justify-center gap-2 shadow-[0_10px_40px_-10px_oklch(0.72_0.18_220/0.8)] hover:shadow-[0_15px_50px_-10px_oklch(0.82_0.17_200/0.9)] transition disabled:opacity-60"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Access Portal
            </motion.button>
          </form>

          <p className="mt-6 text-[11px] text-muted-foreground text-center leading-relaxed">
            Accounts are provisioned by AAI IT administration.<br />
            Contact your admin to request access.
          </p>
        </motion.div>

      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder, icon, required, minLength }: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
  placeholder?: string; icon?: React.ReactNode; required?: boolean; minLength?: number;
}) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">{label}</label>
      <div className="relative">
        {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-glow/70">{icon}</div>}
        <input
          type={type} value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder} required={required} minLength={minLength}
          className={`w-full rounded-xl bg-input border border-border px-4 py-3 text-sm focus:outline-none focus:border-cyan-glow focus:ring-2 focus:ring-cyan-glow/20 transition ${icon ? "pl-10" : ""}`}
        />
      </div>
    </div>
  );
}
