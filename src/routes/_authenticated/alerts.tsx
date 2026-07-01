import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { fetchInventory, fetchCategories } from "@/lib/inventory-api";
import { PageContainer, PageHeader, GlassCard } from "@/components/PageChrome";
import { motion } from "framer-motion";

export const Route = createFileRoute("/_authenticated/alerts")({ component: AlertsPage });

function AlertsPage() {
  const { data: inv = [] } = useQuery({ queryKey: ["inventory"], queryFn: fetchInventory });
  const { data: cats = [] } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });

  // Count in_store items per category
  const alerts = cats.map((c) => {
    const inStore = inv.filter((i) => i.category_id === c.id && i.status === "in_store").length;
    return { ...c, inStore, low: inStore < c.low_stock_threshold };
  }).sort((a, b) => Number(b.low) - Number(a.low));

  const lowCount = alerts.filter((a) => a.low).length;

  return (
    <PageContainer>
      <PageHeader title="Low Stock Alerts" subtitle={`${lowCount} categor${lowCount === 1 ? "y is" : "ies are"} below threshold. Adjust thresholds on the Categories page.`} />

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {alerts.map((a, i) => (
          <motion.div key={a.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <GlassCard className={`p-5 relative overflow-hidden ${a.low ? "border-red-500/40" : ""}`}>
              {a.low && <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-red-500/25 blur-2xl" />}
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold text-lg">{a.name}</div>
                  <div className="text-xs text-muted-foreground mt-1">{a.description || "—"}</div>
                </div>
                {a.low && <AlertTriangle className="w-5 h-5 text-red-400" />}
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className={`text-3xl font-bold ${a.low ? "text-red-400 text-glow" : "text-emerald-400"}`}>{a.inStore}</span>
                <span className="text-xs text-muted-foreground">/ threshold {a.low_stock_threshold}</span>
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div className={`h-full rounded-full ${a.low ? "bg-red-400" : "bg-emerald-400"}`} style={{ width: `${Math.min(100, (a.inStore / Math.max(1, a.low_stock_threshold)) * 100)}%` }} />
              </div>
            </GlassCard>
          </motion.div>
        ))}
        {alerts.length === 0 && (
          <GlassCard className="p-8 text-center text-muted-foreground col-span-full">No categories defined yet.</GlassCard>
        )}
      </div>
    </PageContainer>
  );
}
