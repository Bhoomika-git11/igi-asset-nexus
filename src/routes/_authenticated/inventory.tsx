import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, Pencil, Trash2, X, Save, Monitor, Printer, ScanLine, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchCategories,
  fetchInventory,
  statusColors,
  statusLabel,
  type AssetStatus,
  type InventoryRow,
} from "@/lib/inventory-api";
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

// Asset type tabs
type AssetTab = "all" | "cpu" | "printer" | "scanner" | "ups";

function InventoryPage() {
  const { role } = useAuth();
  const qc = useQueryClient();
  const { data: inv = [], isLoading } = useQuery({ queryKey: ["inventory"], queryFn: fetchInventory });
  const { data: cats = [] } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<AssetStatus | "all">("all");
  const [activeTab, setActiveTab] = useState<AssetTab>("all");
  const [page, setPage] = useState(1);
  const PER_PAGE = 25;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<InventoryRow>>(emptyForm);

  // ── Filtering ──────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const qq = q.toLowerCase();
    return inv.filter((r) => {
      // Status filter
      if (statusFilter !== "all" && r.status !== statusFilter) return false;

      // Tab filter — detect from notes field what type of asset it is
      if (activeTab === "cpu") {
        const notesHasCpu = (r.notes ?? "").toLowerCase().includes("cpu:");
        const serialLooksLikeCpu = !!(r.serial_number && !r.notes?.toLowerCase().includes("printer:") && !r.notes?.toLowerCase().includes("ups:"));
        if (!notesHasCpu && !serialLooksLikeCpu) return false;
      }
      if (activeTab === "printer") {
        if (!(r.notes ?? "").toLowerCase().includes("printer:")) return false;
      }
      if (activeTab === "scanner") {
        if (!(r.notes ?? "").toLowerCase().includes("scanner:")) return false;
      }
      if (activeTab === "ups") {
        if (!(r.notes ?? "").toLowerCase().includes("ups:")) return false;
      }

      // Text search
      if (qq) {
        const searchable = [
          r.asset_tag, r.name, r.department, r.room,
          r.assigned_to, r.serial_number, r.category_name,
          r.manufacturer, r.model, r.notes,
        ].map((v) => (v ?? "").toLowerCase());
        if (!searchable.some((v) => v.includes(qq))) return false;
      }

      return true;
    });
  }, [inv, q, statusFilter, activeTab]);

  // ── Pagination ─────────────────────────────────────────────────────────────
  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const pageRows = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // Reset to page 1 on filter change
  const resetPage = () => setPage(1);

  // ── Mutations ──────────────────────────────────────────────────────────────
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
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("inventory").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory"] }); toast.success("Deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => { setEditing(emptyForm); setOpen(true); };
  const openEdit = (r: InventoryRow) => { setEditing(r); setOpen(true); };

  // ── Parse notes field to extract CPU/Printer/Scanner/UPS info ─────────────
  function parseNotes(notes: string | null) {
    if (!notes) return {};
    const result: Record<string, string> = {};
    notes.split("|").forEach((part) => {
      const trimmed = part.trim();
      if (trimmed.startsWith("CPU:")) result.cpu = trimmed.replace("CPU:", "").trim();
      else if (trimmed.startsWith("Printer:")) result.printer = trimmed.replace("Printer:", "").trim();
      else if (trimmed.startsWith("Scanner:")) result.scanner = trimmed.replace("Scanner:", "").trim();
      else if (trimmed.startsWith("UPS:")) result.ups = trimmed.replace("UPS:", "").trim();
      else if (trimmed.startsWith("OS:")) result.os = trimmed.replace("OS:", "").trim();
      else if (trimmed.startsWith("Designation:")) result.designation = trimmed.replace("Designation:", "").trim();
      else if (trimmed.startsWith("Remarks:")) result.remarks = trimmed.replace("Remarks:", "").trim();
      else if (trimmed.startsWith("Sheet:")) result.sheet = trimmed.replace("Sheet:", "").trim();
    });
    return result;
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <PageContainer>
      <PageHeader
        title="Inventory"
        subtitle={`${filtered.length} of ${inv.length} assets shown`}
        actions={
          canEdit(role) && (
            <button
              onClick={openNew}
              className="rounded-lg bg-gradient-to-r from-electric to-cyan-glow text-navy-deep font-semibold px-4 py-2 text-sm flex items-center gap-2 hover:opacity-90"
            >
              <Plus className="w-4 h-4" /> Add Asset
            </button>
          )
        }
      />

      {/* Search + Status filter */}
      <GlassCard className="p-4 mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); resetPage(); }}
            placeholder="Search by name, serial, room, notes…"
            className="w-full rounded-lg bg-input border border-border pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-cyan-glow"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as AssetStatus | "all"); resetPage(); }}
          className="rounded-lg bg-input border border-border px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-glow"
        >
          <option value="all">All statuses</option>
          {(["in_use", "in_store", "faulty", "retired"] as const).map((s) => (
            <option key={s} value={s}>{statusLabel[s]}</option>
          ))}
        </select>
      </GlassCard>

      {/* Asset type tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {([
          { key: "all",     label: "All Assets",  icon: null },
          { key: "cpu",     label: "CPU / Desktop", icon: <Monitor className="w-3.5 h-3.5" /> },
          { key: "printer", label: "Printers",     icon: <Printer className="w-3.5 h-3.5" /> },
          { key: "scanner", label: "Scanners",     icon: <ScanLine className="w-3.5 h-3.5" /> },
          { key: "ups",     label: "UPS",          icon: <Zap className="w-3.5 h-3.5" /> },
        ] as const).map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => { setActiveTab(key as AssetTab); resetPage(); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
              activeTab === key
                ? "bg-cyan-glow text-navy-deep"
                : "glass border border-border/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <GlassCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border/40">
                <Th>#</Th>
                <Th>Tag</Th>
                <Th>Assigned To</Th>
                <Th>Designation</Th>
                <Th>Room</Th>
                <Th>CPU</Th>
                <Th>Printer</Th>
                <Th>UPS</Th>
                <Th>OS</Th>
                <Th>Status</Th>
                <Th> </Th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-muted-foreground">Loading…</td>
                </tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={11} className="p-12 text-center text-muted-foreground">
                    No assets match your filter.
                  </td>
                </tr>
              )}
              {pageRows.map((r, i) => {
                const parsed = parseNotes(r.notes);
                return (
                  <motion.tr
                    key={r.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.01, 0.3) }}
                    className="border-b border-border/20 hover:bg-white/[0.03] transition"
                  >
                    <Td className="text-muted-foreground text-xs">
                      {(page - 1) * PER_PAGE + i + 1}
                    </Td>
                    <Td className="font-mono text-cyan-glow text-xs whitespace-nowrap">
                      {r.asset_tag}
                    </Td>
                    <Td className="font-medium max-w-[120px]">
                      <div className="truncate" title={r.assigned_to ?? r.name}>
                        {r.assigned_to || r.name || "—"}
                      </div>
                    </Td>
                    <Td className="text-muted-foreground text-xs">
                      {parsed.designation || "—"}
                    </Td>
                    <Td className="text-xs">{r.room || "—"}</Td>
                    <Td className="max-w-[150px]">
                      {parsed.cpu ? (
                        <div>
                          <div className="text-xs truncate" title={parsed.cpu}>
                            {parsed.cpu.split("(S/N:")[0].trim()}
                          </div>
                          {parsed.cpu.includes("S/N:") && (
                            <div className="text-[9px] font-mono text-cyan-glow/70 truncate">
                              {parsed.cpu.split("S/N:")[1]?.replace(")", "").trim()}
                            </div>
                          )}
                        </div>
                      ) : r.manufacturer ? (
                        <div className="text-xs">{r.manufacturer} {r.model}</div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </Td>
                    <Td className="max-w-[140px]">
                      {parsed.printer ? (
                        <div>
                          <div className="text-xs truncate" title={parsed.printer}>
                            {parsed.printer.split("(S/N:")[0].trim()}
                          </div>
                          {parsed.printer.includes("S/N:") && (
                            <div className="text-[9px] font-mono text-cyan-glow/70 truncate">
                              {parsed.printer.split("S/N:")[1]?.replace(")", "").trim()}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </Td>
                    <Td className="max-w-[100px]">
                      {parsed.ups ? (
                        <div className="text-xs truncate" title={parsed.ups}>
                          {parsed.ups.split("(S/N:")[0].trim()}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </Td>
                    <Td className="text-xs text-muted-foreground max-w-[80px]">
                      <div className="truncate" title={parsed.os}>
                        {parsed.os || "—"}
                      </div>
                    </Td>
                    <Td>
                      <span
                        className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded border ${statusColors[r.status]}`}
                      >
                        {statusLabel[r.status]}
                      </span>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-1 justify-end">
                        {canEdit(role) && (
                          <IconBtn onClick={() => openEdit(r)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </IconBtn>
                        )}
                        {canDelete(role) && (
                          <IconBtn
                            onClick={() => {
                              if (confirm(`Delete ${r.asset_tag}?`)) del.mutate(r.id);
                            }}
                            danger
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </IconBtn>
                        )}
                      </div>
                    </Td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-border/40 flex items-center justify-between text-sm">
            <div className="text-muted-foreground text-xs">
              Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} of{" "}
              {filtered.length} assets
            </div>
            <div className="flex gap-1">
              <PageBtn disabled={page === 1} onClick={() => setPage((p) => p - 1)}>← Prev</PageBtn>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, idx) => {
                const pg = idx + 1;
                return (
                  <PageBtn key={pg} active={pg === page} onClick={() => setPage(pg)}>
                    {pg}
                  </PageBtn>
                );
              })}
              {totalPages > 7 && page < totalPages && (
                <PageBtn onClick={() => setPage(totalPages)}>…{totalPages}</PageBtn>
              )}
              <PageBtn disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>Next →</PageBtn>
            </div>
          </div>
        )}
      </GlassCard>

      <AnimatePresence>
        {open && (
          <AssetDialog
            initial={editing}
            cats={cats}
            onClose={() => setOpen(false)}
            onSave={(v) => save.mutate(v)}
            saving={save.isPending}
          />
        )}
      </AnimatePresence>
    </PageContainer>
  );
}

// ── Small helpers ──────────────────────────────────────────────────────────────
function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 whitespace-nowrap">{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}
function IconBtn({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`p-2 rounded-md transition ${danger ? "hover:bg-destructive/20 text-destructive" : "hover:bg-white/10 text-cyan-glow"}`}
    >
      {children}
    </button>
  );
}
function PageBtn({
  children, onClick, disabled, active,
}: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean; active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1.5 rounded-lg text-xs transition ${
        active
          ? "bg-cyan-glow text-navy-deep font-bold"
          : "bg-white/5 hover:bg-white/10 text-muted-foreground disabled:opacity-30"
      }`}
    >
      {children}
    </button>
  );
}

// ── Add/Edit Dialog ────────────────────────────────────────────────────────────
function AssetDialog({
  initial, cats, onClose, onSave, saving,
}: {
  initial: Partial<InventoryRow>;
  cats: { id: string; name: string }[];
  onClose: () => void;
  onSave: (v: Partial<InventoryRow>) => void;
  saving: boolean;
}) {
  const [f, setF] = useState<Partial<InventoryRow>>(initial);
  const upd = <K extends keyof InventoryRow>(k: K, v: InventoryRow[K] | null) =>
    setF((s) => ({ ...s, [k]: v }));

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
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Inp label="Asset Tag *" v={f.asset_tag ?? ""} on={(v) => upd("asset_tag", v)} />
          <Inp label="Assigned To *" v={f.assigned_to ?? ""} on={(v) => upd("assigned_to", v)} />
          <Inp label="Name / Description" v={f.name ?? ""} on={(v) => upd("name", v)} />
          <Sel
            label="Status"
            v={f.status ?? "in_store"}
            on={(v) => upd("status", v as AssetStatus)}
            opts={(["in_use", "in_store", "faulty", "retired"] as const).map((s) => ({
              v: s, l: statusLabel[s],
            }))}
          />
          <Inp label="Department" v={f.department ?? ""} on={(v) => upd("department", v)} />
          <Inp label="Room / Location" v={f.room ?? ""} on={(v) => upd("room", v)} />
          <Inp label="Manufacturer / CPU Make" v={f.manufacturer ?? ""} on={(v) => upd("manufacturer", v)} />
          <Inp label="Model" v={f.model ?? ""} on={(v) => upd("model", v)} />
          <Inp label="Serial Number" v={f.serial_number ?? ""} on={(v) => upd("serial_number", v)} />
          <Sel
            label="Category"
            v={f.category_id ?? ""}
            on={(v) => upd("category_id", v || null)}
            opts={[{ v: "", l: "—" }, ...cats.map((c) => ({ v: c.id, l: c.name }))]}
          />
          <Inp label="Purchase Date" type="date" v={f.purchase_date ?? ""} on={(v) => upd("purchase_date", v || null)} />
          <Inp label="Purchase Cost (₹)" type="number" v={String(f.purchase_cost ?? "")} on={(v) => upd("purchase_cost", v ? Number(v) : 0)} />
          <div className="col-span-2">
            <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">
              Notes / Remarks
            </label>
            <textarea
              value={f.notes ?? ""}
              onChange={(e) => upd("notes", e.target.value)}
              className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:border-cyan-glow"
              rows={3}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-white/5">
            Cancel
          </button>
          <button
            onClick={() => onSave(f)}
            disabled={saving || !f.asset_tag}
            className="rounded-lg bg-gradient-to-r from-electric to-cyan-glow text-navy-deep font-semibold px-5 py-2 text-sm flex items-center gap-2 disabled:opacity-50"
          >
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
      <input
        type={type} value={v} onChange={(e) => on(e.target.value)}
        className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:border-cyan-glow"
      />
    </div>
  );
}

function Sel({ label, v, on, opts }: { label: string; v: string; on: (v: string) => void; opts: { v: string; l: string }[] }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">{label}</label>
      <select
        value={v} onChange={(e) => on(e.target.value)}
        className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:border-cyan-glow"
      >
        {opts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );
}
