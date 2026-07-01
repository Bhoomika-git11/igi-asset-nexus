import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader, GlassCard } from "@/components/PageChrome";
import { motion } from "framer-motion";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ChevronDown, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/audit")({ component: AuditPage });

interface AuditRow {
  id: string; table_name: string; record_id: string | null; action: string;
  old_values: Record<string, unknown> | null; new_values: Record<string, unknown> | null;
  changed_by_email: string | null; created_at: string;
}

function AuditPage() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit"],
    queryFn: async () => {
      const { data, error } = await supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return (data ?? []) as AuditRow[];
    },
  });
  const [openId, setOpenId] = useState<string | null>(null);

  const actionColor = (a: string) => a === "INSERT" ? "text-emerald-400 border-emerald-500/40 bg-emerald-500/10"
    : a === "UPDATE" ? "text-sky-400 border-sky-500/40 bg-sky-500/10"
    : "text-red-400 border-red-500/40 bg-red-500/10";

  return (
    <PageContainer>
      <PageHeader title="Audit Log" subtitle="Every change ever made — with before/after values." />
      <GlassCard className="overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading…</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No activity yet.</div>
        ) : (
          <div className="divide-y divide-border/30">
            {logs.map((l, i) => {
              const open = openId === l.id;
              return (
                <motion.div key={l.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.01, 0.3) }}>
                  <button onClick={() => setOpenId(open ? null : l.id)} className="w-full text-left flex items-center gap-4 px-4 py-3 hover:bg-white/[0.03]">
                    {open ? <ChevronDown className="w-4 h-4 text-cyan-glow" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                    <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded border ${actionColor(l.action)}`}>{l.action}</span>
                    <span className="text-sm font-mono text-cyan-glow">{l.table_name}</span>
                    <span className="text-sm flex-1 truncate">
                      {(l.new_values?.name as string) ?? (l.old_values?.name as string) ?? l.record_id ?? "—"}
                    </span>
                    <span className="text-xs text-muted-foreground hidden md:inline">{l.changed_by_email ?? "system"}</span>
                    <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(l.created_at))} ago</span>
                  </button>
                  {open && (
                    <div className="px-12 pb-4 grid md:grid-cols-2 gap-3 text-xs">
                      <div>
                        <div className="uppercase tracking-wider text-muted-foreground mb-1">Before</div>
                        <pre className="bg-black/40 rounded p-3 overflow-auto max-h-64 border border-border/40">{l.old_values ? JSON.stringify(l.old_values, null, 2) : "—"}</pre>
                      </div>
                      <div>
                        <div className="uppercase tracking-wider text-muted-foreground mb-1">After</div>
                        <pre className="bg-black/40 rounded p-3 overflow-auto max-h-64 border border-border/40">{l.new_values ? JSON.stringify(l.new_values, null, 2) : "—"}</pre>
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </GlassCard>
    </PageContainer>
  );
}
