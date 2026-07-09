import { useEffect, useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Lock, Mail, Loader2, ArrowLeft, type LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AAILogo } from "@/components/AAILogo";
import { ParticleField } from "@/components/ParticleField";
import { toast } from "sonner";

export interface RoleLoginTheme {
  role: "admin" | "manager" | "user";
  title: string;
  subtitle: string;
  badge: string;
  badgeIcon: LucideIcon;
  accentFrom: string; // tailwind gradient stop e.g. "from-red-500"
  accentTo: string;   // e.g. "to-amber-400"
  ring: string;       // e.g. "ring-red-500/40"
  border: string;     // e.g. "border-red-500/40"
  glow: string;       // e.g. "shadow-red-500/30"
  text: string;       // e.g. "text-amber-300"
  bgOrb1: string;     // e.g. "bg-red-500/20"
  bgOrb2: string;     // e.g. "bg-amber-400/15"
  emailLabel?: string;
  emailPlaceholder?: string;
  backdrop?: "globe" | "grid" | "particles";
}

export function RoleLoginPage({ theme }: { theme: RoleLoginTheme }) {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const Badge = theme.badgeIcon;

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
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden flex items-center justify-center px-4">
      {/* Backdrop */}
      {theme.backdrop === "particles" && <ParticleField />}
      {theme.backdrop !== "particles" && <div className="absolute inset-0 grid-bg opacity-40" />}
      <div className={`absolute -top-40 -left-40 w-[560px] h-[560px] rounded-full blur-3xl ${theme.bgOrb1}`} />
      <div className={`absolute -bottom-40 -right-40 w-[560px] h-[560px] rounded-full blur-3xl ${theme.bgOrb2}`} />
      {theme.backdrop === "globe" && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
          <div className="globe-scene relative h-[420px] w-[420px]">
            <div className="globe-pulse" />
            <div className="globe-ring-2" />
            <div className="globe-ring" />
            <div className="globe" />
          </div>
        </div>
      )}

      {/* Top-left brand + back link */}
      <div className="absolute top-6 left-6 z-20 flex items-center gap-4">
        <Link to="/" className="p-2 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground transition">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex items-center gap-3">
          <AAILogo className="w-11 h-11" />
          <div>
            <div className="text-sm font-bold leading-tight">Airports Authority</div>
            <div className={`text-[10px] uppercase tracking-widest ${theme.text}`}>of India</div>
          </div>
        </div>
      </div>

      {/* Login card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className={`relative z-10 glass-strong rounded-3xl p-10 w-full max-w-md border ${theme.border} shadow-2xl ${theme.glow}`}
      >
        <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/60 border ${theme.border} text-[10px] uppercase tracking-widest ${theme.text} flex items-center gap-1.5`}>
          <Badge className="w-3 h-3" /> {theme.badge}
        </div>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight">{theme.title}</h1>
          <p className={`text-xs mt-2 uppercase tracking-[0.2em] ${theme.text}/80`}>{theme.subtitle}</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <Field
            icon={<Mail className="w-4 h-4" />}
            type="email"
            label={theme.emailLabel ?? "Email"}
            value={email}
            onChange={setEmail}
            placeholder={theme.emailPlaceholder ?? "you@aai.aero"}
            required
            ringClass={theme.ring}
          />
          <Field
            icon={<Lock className="w-4 h-4" />}
            type="password"
            label="Password"
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
            required
            minLength={6}
            ringClass={theme.ring}
          />

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={loading}
            type="submit"
            className={`w-full mt-2 rounded-xl bg-gradient-to-r ${theme.accentFrom} ${theme.accentTo} text-navy-deep font-semibold py-3.5 flex items-center justify-center gap-2 shadow-lg hover:brightness-110 transition disabled:opacity-60`}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Sign in
          </motion.button>
        </form>

        <p className="mt-6 text-[11px] text-muted-foreground text-center leading-relaxed">
          Accounts are provisioned by AAI IT administration.
        </p>
      </motion.div>
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", placeholder, icon, required, minLength, ringClass,
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
  placeholder?: string; icon?: React.ReactNode; required?: boolean; minLength?: number;
  ringClass: string;
}) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">{label}</label>
      <div className="relative">
        {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</div>}
        <input
          type={type} value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder} required={required} minLength={minLength}
          className={`w-full rounded-xl bg-input border border-border px-4 py-3 text-sm focus:outline-none focus:ring-2 ${ringClass} focus:border-transparent transition ${icon ? "pl-10" : ""}`}
        />
      </div>
    </div>
  );
}
