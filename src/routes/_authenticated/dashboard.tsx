import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useState } from "react";
import { Boxes, CheckCircle2, AlertTriangle, Archive, Package, TrendingUp } from "lucide-react";
import { fetchInventory, statusColors, statusLabel } from "@/lib/inventory-api";
import { PageContainer, PageHeader, GlassCard } from "@/components/PageChrome";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

function Dashboard() {
  const { user } = useAuth();
  const { data: inv = [] } = useQuery({ queryKey: ["inventory"], queryFn: fetchInventory });

  const counts = {
    total: inv.length,
    in_use: inv.filter((i) => i.status === "in_use").length,
    faulty: inv.filter((i) => i.status === "faulty").length,
    in_store: inv.filter((i) => i.status === "in_store").length,
    retired: inv.filter((i) => i.status === "retired").length,
  };
  const totalCost = inv.reduce((s, i) => s + (Number(i.purchase_cost) || 0), 0);

  const stats = [
    { label: "Total Assets", value: counts.total, icon: Boxes, color: "from-electric to-cyan-glow" },
    { label: "In Use", value: counts.in_use, icon: CheckCircle2, color: "from-emerald-500 to-teal-400" },
    { label: "In Store", value: counts.in_store, icon: Package, color: "from-sky-500 to-cyan-400" },
    { label: "Faulty", value: counts.faulty, icon: AlertTriangle, color: "from-red-500 to-orange-400" },
    { label: "Retired", value: counts.retired, icon: Archive, color: "from-zinc-500 to-zinc-400" },
    { label: "Total Value (₹)", value: `₹${(totalCost / 100000).toFixed(1)}L`, icon: TrendingUp, color: "from-purple-500 to-pink-400" },
  ];

  const recent = inv.slice(0, 8);

  return (
    <PageContainer>
      <PageHeader
        title={`Welcome, ${user?.email?.split("@")[0] ?? "Operator"}`}
        subtitle="Real-time IT asset overview across all IGI Airport departments."
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {stats.map((s, i) => (
          <StatCard key={s.label} {...s} delay={i * 0.06} />
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <GlassCard className="lg:col-span-2 p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyan-glow animate-pulse" /> Recent Assets
          </h3>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No assets yet. Add some from Inventory.</p>
          ) : (
            <div className="space-y-2">
              {recent.map((r, i) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                  className="flex items-center justify-between px-4 py-3 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{r.name}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {r.asset_tag} · {r.department || "—"} · {r.room || "—"}
                    </div>
                  </div>
                  <span className={`shrink-0 text-[10px] uppercase tracking-wider px-2 py-1 rounded border ${statusColors[r.status]}`}>
                    {statusLabel[r.status]}
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </GlassCard>

        <GlassCard className="p-6">
          <h3 className="font-semibold mb-4">Status Distribution</h3>
          <div className="space-y-3">
            {(["in_use", "in_store", "faulty", "retired"] as const).map((s) => {
              const pct = counts.total ? (counts[s] / counts.total) * 100 : 0;
              return (
                <div key={s}>
                  <div className="flex justify-between text-xs mb-1">
                    <span>{statusLabel[s]}</span>
                    <span className="text-muted-foreground">{counts[s]} · {pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: "easeOut" }}
                      className={`h-full rounded-full ${
                        s === "in_use" ? "bg-emerald-400" :
                        s === "in_store" ? "bg-sky-400" :
                        s === "faulty" ? "bg-red-400" : "bg-zinc-400"
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      </div>
    </PageContainer>
  );
}

function useCountUp(target: number, duration = 1200) {
  const [n, setN] = useState(0);
  const numeric = typeof target === "number" && isFinite(target) ? target : 0;
  const [start] = useState(() => performance.now());
  const [current] = useState({ v: 0 });
  useState(() => 0);
  // simple rAF loop
  if (typeof window !== "undefined") {
    // Kick a rAF once per mount
  }
  useEffectOnce(() => {
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(numeric * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  });
  return Math.round(n);
  // note: unused refs kept for clarity
  void start; void current;
}

function useEffectOnce(fn: () => void | (() => void)) {
  const [ran, setRan] = useState(false);
  if (!ran) {
    setRan(true);
    // defer to after render
    queueMicrotask(() => {
      const cleanup = fn();
      if (typeof cleanup === "function") {
        // no unmount tracking; fine for dashboard mount
        void cleanup;
      }
    });
  }
}

function StatCard({ label, value, icon: Icon, color, delay }: {
  label: string; value: number | string; icon: React.ComponentType<{ className?: string }>; color: string; delay: number;
}) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const isNumeric = typeof value === "number";
  const counted = useCountUp(isNumeric ? (value as number) : 0);
  const display = isNumeric ? counted.toLocaleString("en-IN") : value;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      onMouseMove={(e) => {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setTilt({ x: ((e.clientY - r.top) / r.height - 0.5) * -12, y: ((e.clientX - r.left) / r.width - 0.5) * 12 });
      }}
      onMouseLeave={() => setTilt({ x: 0, y: 0 })}
      style={{ transform: `perspective(900px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateZ(0)` }}
      className="glass rounded-2xl p-5 relative overflow-hidden transition-transform duration-200 hover:shadow-[0_0_40px_-5px_oklch(0.82_0.17_200/0.5)]"
    >
      <div className={`absolute -top-8 -right-8 w-32 h-32 rounded-full bg-gradient-to-br ${color} opacity-20 blur-2xl`} />
      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center mb-3 shadow-lg`}>
        <Icon className="w-5 h-5 text-navy-deep" />
      </div>
      <div className="text-2xl font-bold text-glow">{display}</div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground mt-1">{label}</div>
    </motion.div>
  );
}
