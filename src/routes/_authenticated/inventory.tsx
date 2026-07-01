import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, Pencil, Trash2, X, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchCategories, fetchInventory, statusColors, statusLabel, type AssetStatus, type InventoryRow } from "@/lib/inventory-api";
import { PageContainer, PageHeader, GlassCard } from "@/components/PageChrome";
import { canDelete, canEdit, useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/inventory")({ component: InventoryPage });

const emptyForm: Partial<InventoryRow> = {
  asset_tag: "", name: "", category_id: null, category_name: "",
  department: "", room: "", assigned_to: "", status: "in_store",
  serial_number: "", manufacturer: "", model: "",
  purchase_date: null, purchase_cost: 0, warranty_expiry: null, notes: "",
};

function InventoryPage() {
  const { role } = useAuth();
  const qc = useQueryClient();
  const { data: inv = [], isLoading } = useQuery({ queryKey: ["inventory"], queryFn: fetchInventory });
  const { data: cats = [] } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<AssetStatus | "all">("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<InventoryRow>>(emptyForm);

  const filtered = useMemo(() => {
    const qq = q.toLowerCase();
    return inv.filter((r) =>
      (statusFilter === "all" || r.status === statusFilter) &&
      (!qq || [r.asset_tag, r.name, r.department, r.room, r.assigned_to, r.serial_number, r.category_name]
        .some((v) => (v ?? "").toLowerCase().includes(qq)))
    );
  }, [inv, q, statusFilter]);

  const save = useMutation({
    mutationFn: async (payload: Partial<InventoryRow>) => {
      const cat = cats.find((c) => c.id === payload.category_id);
      const row = { ...payload, category_name: cat?.name ?? payload.category_name ?? null };
      if (row.id) {
        const { error } = await supabase.from("inventory").update(row).eq("id", row.id);
        if (error) throw error;
      } else {
        const { id: _ignored, ...insertRow } = row as Record<string, unknown> & { id?: string };
        const { error } = await supabase.from("inventory").insert(insertRow as never);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory"] }); toast.success("Saved"); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("inventory").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory"] }); toast.success("Deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => { setEditing(emptyForm); setOpen(true); };
  const openEdit = (r: InventoryRow) => { setEditing(r); setOpen(true); };

  return (
    <PageContainer>
      <PageHeader
        title="Inventory"
        subtitle={`${filtered.length} of ${inv.length} assets shown`}
        actions={canEdit(role) && (
          <button onClick={openNew} className="rounded-lg bg-gradient-to-r from-electric to-cyan-glow text-navy-deep font-semibold px-4 py-2 text-sm flex items-center gap-2 hover:opacity-90">
            <Plus className="w-4 h-4" /> Add Asset
          </button>
        )}
      />

      <GlassCard className="p-4 mb-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search by tag, name, dept, serial…"
            className="w-full rounded-lg bg-input border border-border pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-cyan-glow"
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as AssetStatus | "all")}
          className="rounded-lg bg-input border border-border px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-glow">
          <option value="all">All statuses</option>
          {(["in_use", "in_store", "faulty", "retired"] as const).map((s) => (
            <option key={s} value={s}>{statusLabel[s]}</option>
          ))}
        </select>
      </GlassCard>

      <GlassCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border/40">
                <Th>Tag</Th><Th>Name</Th><Th>Category</Th><Th>Department</Th><Th>Room</Th><Th>Assigned To</Th><Th>Status</Th><Th>{" "}</Th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Loading…</td></tr>}
              {!isLoading && filtered.length === 0 && <tr><td colSpan={8} className="p-12 text-center text-muted-foreground">No assets match your filter.</td></tr>}
              {filtered.map((r, i) => (
                <motion.tr
                  key={r.id}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.015, 0.4) }}
                  className="border-b border-border/20 hover:bg-white/[0.03] transition"
                >
                  <Td className="font-mono text-cyan-glow">{r.asset_tag}</Td>
                  <Td className="font-medium">{r.name}</Td>
                  <Td>{r.category_name || "—"}</Td>
                  <Td>{r.department || "—"}</Td>
                  <Td>{r.room || "—"}</Td>
                  <Td>{r.assigned_to || "—"}</Td>
                  <Td><span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded border ${statusColors[r.status]}`}>{statusLabel[r.status]}</span></Td>
                  <Td>
                    <div className="flex items-center gap-1 justify-end">
                      {canEdit(role) && <IconBtn onClick={() => openEdit(r)}><Pencil className="w-3.5 h-3.5" /></IconBtn>}
                      {canDelete(role) && <IconBtn onClick={() => { if (confirm(`Delete ${r.asset_tag}?`)) del.mutate(r.id); }} danger><Trash2 className="w-3.5 h-3.5" /></IconBtn>}
                    </div>
                  </Td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <AnimatePresence>
        {open && (
          <AssetDialog
            initial={editing} cats={cats}
            onClose={() => setOpen(false)}
            onSave={(v) => save.mutate(v)}
            saving={save.isPending}
          />
        )}
      </AnimatePresence>
    </PageContainer>
  );
}

function Th({ children }: { children: React.ReactNode }) { return <th className="px-4 py-3">{children}</th>; }
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}
function IconBtn({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`p-2 rounded-md transition ${danger ? "hover:bg-destructive/20 text-destructive" : "hover:bg-white/10 text-cyan-glow"}`}>
      {children}
    </button>
  );
}

function AssetDialog({ initial, cats, onClose, onSave, saving }: {
  initial: Partial<InventoryRow>; cats: { id: string; name: string }[];
  onClose: () => void; onSave: (v: Partial<InventoryRow>) => void; saving: boolean;
}) {
  const [f, setF] = useState<Partial<InventoryRow>>(initial);
  const upd = <K extends keyof InventoryRow>(k: K, v: InventoryRow[K] | null) => setF((s) => ({ ...s, [k]: v }));

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-strong rounded-2xl p-8 w-full max-w-3xl my-8"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold">{f.id ? "Edit Asset" : "New Asset"}</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Inp label="Asset Tag *" v={f.asset_tag ?? ""} on={(v) => upd("asset_tag", v)} />
          <Inp label="Name *" v={f.name ?? ""} on={(v) => upd("name", v)} />
          <Sel label="Category" v={f.category_id ?? ""} on={(v) => upd("category_id", v || null)} opts={[{ v: "", l: "—" }, ...cats.map((c) => ({ v: c.id, l: c.name }))]} />
          <Sel label="Status" v={f.status ?? "in_store"} on={(v) => upd("status", v as AssetStatus)}
            opts={(["in_use", "in_store", "faulty", "retired"] as const).map((s) => ({ v: s, l: statusLabel[s] }))} />
          <Inp label="Department" v={f.department ?? ""} on={(v) => upd("department", v)} />
          <Inp label="Room / Location" v={f.room ?? ""} on={(v) => upd("room", v)} />
          <Inp label="Assigned To" v={f.assigned_to ?? ""} on={(v) => upd("assigned_to", v)} />
          <Inp label="Serial Number" v={f.serial_number ?? ""} on={(v) => upd("serial_number", v)} />
          <Inp label="Manufacturer" v={f.manufacturer ?? ""} on={(v) => upd("manufacturer", v)} />
          <Inp label="Model" v={f.model ?? ""} on={(v) => upd("model", v)} />
          <Inp label="Purchase Date" type="date" v={f.purchase_date ?? ""} on={(v) => upd("purchase_date", v || null)} />
          <Inp label="Purchase Cost (₹)" type="number" v={String(f.purchase_cost ?? "")} on={(v) => upd("purchase_cost", v ? Number(v) : 0)} />
          <Inp label="Warranty Expiry" type="date" v={f.warranty_expiry ?? ""} on={(v) => upd("warranty_expiry", v || null)} />
          <div className="col-span-2">
            <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Notes</label>
            <textarea value={f.notes ?? ""} onChange={(e) => upd("notes", e.target.value)}
              className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:border-cyan-glow" rows={3} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-white/5">Cancel</button>
          <button onClick={() => onSave(f)} disabled={saving || !f.asset_tag || !f.name}
            className="rounded-lg bg-gradient-to-r from-electric to-cyan-glow text-navy-deep font-semibold px-5 py-2 text-sm flex items-center gap-2 disabled:opacity-50">
            <Save className="w-4 h-4" /> {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Inp({ label, v, on, type = "text" }: { label: string; v: string; on: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">{label}</label>
      <input type={type} value={v} onChange={(e) => on(e.target.value)}
        className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:border-cyan-glow" />
    </div>
  );
}
function Sel({ label, v, on, opts }: { label: string; v: string; on: (v: string) => void; opts: { v: string; l: string }[] }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">{label}</label>
      <select value={v} onChange={(e) => on(e.target.value)}
        className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:border-cyan-glow">
        {opts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );
}
