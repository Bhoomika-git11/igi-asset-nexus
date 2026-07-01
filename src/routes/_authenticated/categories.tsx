import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchCategories } from "@/lib/inventory-api";
import { PageContainer, PageHeader, GlassCard } from "@/components/PageChrome";
import { canDelete, canEdit, useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { motion } from "framer-motion";

export const Route = createFileRoute("/_authenticated/categories")({ component: CategoriesPage });

function CategoriesPage() {
  const { role } = useAuth();
  const qc = useQueryClient();
  const { data: cats = [] } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const [drafts, setDrafts] = useState<Record<string, { name: string; description: string; low_stock_threshold: number }>>({});
  const [creating, setCreating] = useState(false);
  const [newC, setNewC] = useState({ name: "", description: "", low_stock_threshold: 5 });

  const save = useMutation({
    mutationFn: async (v: { id?: string; name: string; description: string; low_stock_threshold: number }) => {
      if (v.id) {
        const { error } = await supabase.from("categories").update({ name: v.name, description: v.description, low_stock_threshold: v.low_stock_threshold }).eq("id", v.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("categories").insert({ name: v.name, description: v.description, low_stock_threshold: v.low_stock_threshold });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["categories"] }); toast.success("Saved"); setCreating(false); setNewC({ name: "", description: "", low_stock_threshold: 5 }); setDrafts({}); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("categories").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["categories"] }); toast.success("Deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <PageContainer>
      <PageHeader title="Categories" subtitle="Asset categories and their low-stock thresholds."
        actions={canEdit(role) && (
          <button onClick={() => setCreating(true)} className="rounded-lg bg-gradient-to-r from-electric to-cyan-glow text-navy-deep font-semibold px-4 py-2 text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Category
          </button>
        )}
      />

      {creating && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <GlassCard className="p-5 mb-4 flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[180px]"><Lbl>Name</Lbl><Inp v={newC.name} on={(v) => setNewC({ ...newC, name: v })} /></div>
            <div className="flex-1 min-w-[220px]"><Lbl>Description</Lbl><Inp v={newC.description} on={(v) => setNewC({ ...newC, description: v })} /></div>
            <div className="w-32"><Lbl>Threshold</Lbl><Inp type="number" v={String(newC.low_stock_threshold)} on={(v) => setNewC({ ...newC, low_stock_threshold: Number(v) || 0 })} /></div>
            <button onClick={() => save.mutate(newC)} disabled={!newC.name} className="rounded-lg bg-primary/80 hover:bg-primary text-primary-foreground px-4 py-2 text-sm font-medium flex items-center gap-1 disabled:opacity-50"><Save className="w-3.5 h-3.5" /> Save</button>
            <button onClick={() => setCreating(false)} className="p-2 rounded-lg hover:bg-white/5"><X className="w-4 h-4" /></button>
          </GlassCard>
        </motion.div>
      )}

      <GlassCard className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border/40">
              <th className="px-4 py-3">Name</th><th className="px-4 py-3">Description</th><th className="px-4 py-3">Low-stock Threshold</th><th className="px-4 py-3"> </th>
            </tr>
          </thead>
          <tbody>
            {cats.map((c) => {
              const d = drafts[c.id] ?? { name: c.name, description: c.description ?? "", low_stock_threshold: c.low_stock_threshold };
              const dirty = drafts[c.id] && (d.name !== c.name || d.description !== (c.description ?? "") || d.low_stock_threshold !== c.low_stock_threshold);
              return (
                <tr key={c.id} className="border-b border-border/20 hover:bg-white/[0.02]">
                  <td className="px-4 py-3"><Inp v={d.name} on={(v) => setDrafts((s) => ({ ...s, [c.id]: { ...d, name: v } }))} disabled={!canEdit(role)} /></td>
                  <td className="px-4 py-3"><Inp v={d.description} on={(v) => setDrafts((s) => ({ ...s, [c.id]: { ...d, description: v } }))} disabled={!canEdit(role)} /></td>
                  <td className="px-4 py-3 w-40"><Inp type="number" v={String(d.low_stock_threshold)} on={(v) => setDrafts((s) => ({ ...s, [c.id]: { ...d, low_stock_threshold: Number(v) || 0 } }))} disabled={!canEdit(role)} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      {canEdit(role) && dirty && <button onClick={() => save.mutate({ id: c.id, ...d })} className="p-2 rounded-md text-cyan-glow hover:bg-white/10"><Save className="w-4 h-4" /></button>}
                      {canDelete(role) && <button onClick={() => { if (confirm(`Delete "${c.name}"?`)) del.mutate(c.id); }} className="p-2 rounded-md text-destructive hover:bg-destructive/20"><Trash2 className="w-4 h-4" /></button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </GlassCard>
    </PageContainer>
  );
}

function Lbl({ children }: { children: React.ReactNode }) { return <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">{children}</label>; }
function Inp({ v, on, type = "text", disabled }: { v: string; on: (v: string) => void; type?: string; disabled?: boolean }) {
  return <input disabled={disabled} type={type} value={v} onChange={(e) => on(e.target.value)}
    className="w-full rounded-md bg-input border border-border px-3 py-1.5 text-sm focus:outline-none focus:border-cyan-glow disabled:opacity-60" />;
}
