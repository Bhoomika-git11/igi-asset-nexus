import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, Pencil, Trash2, X, Save, ChevronRight, ChevronDown, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchCategories, fetchInventory, statusKind, statusKindStyle,
  type InventoryRow,
} from "@/lib/inventory-api";
import { PageContainer, PageHeader, GlassCard } from "@/components/PageChrome";
import { canDelete, canEdit, useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/inventory")({ component: InventoryPage });

type CatTab = "all" | "cpu" | "printer" | "scanner" | "ups";

const emptyForm: Partial<InventoryRow> = {
  asset_tag: "", name: "", designation: "", department: "", room: "",
  sub_assigned_to: "", source_sheet: "",
  cpu_make: "", cpu_model: "", cpu_serial: "",
  printer_make: "", printer_model: "", printer_serial: "",
  scanner_make: "", scanner_model: "", scanner_serial: "",
  ups_make_model: "", ups_serial: "",
  windows_os: "", status_text: "OK", status: "in_use",
};

function uniq(arr: (string | null | undefined)[]) {
  return Array.from(new Set(arr.map((x) => (x ?? "").trim()).filter(Boolean))).sort();
}

function InventoryPage() {
  const { role } = useAuth();
  const qc = useQueryClient();
  const { data: inv = [], isLoading } = useQuery({ queryKey: ["inventory"], queryFn: fetchInventory });
  const { data: cats = [] } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });

  const [q, setQ] = useState("");
  const [tab, setTab] = useState<CatTab>("all");
  const [dept, setDept] = useState("all");
  const [cpuMake, setCpuMake] = useState("all");
  const [prMake, setPrMake] = useState("all");
  const [upsMake, setUpsMake] = useState("all");
  const [os, setOs] = useState("all");
  const [statusF, setStatusF] = useState("all");
  const [desg, setDesg] = useState("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<InventoryRow>>(emptyForm);

  const depts   = useMemo(() => uniq(inv.map((r) => r.department)), [inv]);
  const cpuBs   = useMemo(() => uniq(inv.map((r) => r.cpu_make)), [inv]);
  const prBs    = useMemo(() => uniq(inv.map((r) => r.printer_make)), [inv]);
  const upsBs   = useMemo(() => uniq(inv.map((r) => r.ups_make_model)), [inv]);
  const oses    = useMemo(() => uniq(inv.map((r) => r.windows_os)), [inv]);
  const desgs   = useMemo(() => uniq(inv.map((r) => r.designation)), [inv]);
  const stats   = useMemo(() => uniq(inv.map((r) => r.status_text)), [inv]);

  const { parents, childrenByParent } = useMemo(() => {
    const parents = inv.filter((r) => !r.parent_id);
    const childrenByParent = new Map<string, InventoryRow[]>();
    for (const r of inv) if (r.parent_id) {
      const list = childrenByParent.get(r.parent_id) ?? [];
      list.push(r);
      childrenByParent.set(r.parent_id, list);
    }
    return { parents, childrenByParent };
  }, [inv]);

  const matchesTab = (r: InventoryRow) => {
    if (tab === "all") return true;
    if (tab === "cpu") return !!(r.cpu_make || r.cpu_model || r.cpu_serial);
    if (tab === "printer") return !!(r.printer_make || r.printer_model || r.printer_serial);
    if (tab === "scanner") return !!(r.scanner_make || r.scanner_model || r.scanner_serial);
    if (tab === "ups") return !!(r.ups_make_model || r.ups_serial);
    return true;
  };

  const qq = q.trim().toLowerCase();
  const matchesRow = (r: InventoryRow) => {
    if (!matchesTab(r)) return false;
    if (dept !== "all" && (r.department ?? "") !== dept) return false;
    if (cpuMake !== "all" && (r.cpu_make ?? "") !== cpuMake) return false;
    if (prMake !== "all" && (r.printer_make ?? "") !== prMake) return false;
    if (upsMake !== "all" && (r.ups_make_model ?? "") !== upsMake) return false;
    if (os !== "all" && (r.windows_os ?? "") !== os) return false;
    if (desg !== "all" && (r.designation ?? "") !== desg) return false;
    if (statusF !== "all" && (r.status_text ?? "") !== statusF) return false;
    if (!qq) return true;
    return [
      r.name, r.designation, r.room, r.department, r.sub_assigned_to,
      r.cpu_make, r.cpu_model, r.cpu_serial,
      r.printer_make, r.printer_model, r.printer_serial,
      r.scanner_make, r.scanner_model, r.scanner_serial,
      r.ups_make_model, r.ups_serial, r.windows_os, r.status_text,
    ].some((v) => (v ?? "").toLowerCase().includes(qq));
  };

  const visibleParents = useMemo(() => {
    return parents.filter((p) => {
      if (matchesRow(p)) return true;
      // include parent if any child matches — so search finds sub-assets
      const kids = childrenByParent.get(p.id) ?? [];
      return kids.some(matchesRow);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parents, childrenByParent, q, tab, dept, cpuMake, prMake, upsMake, os, desg, statusF]);

  const totalMatched = useMemo(
    () => visibleParents.reduce((n, p) => n + 1 + (childrenByParent.get(p.id)?.length ?? 0), 0),
    [visibleParents, childrenByParent],
  );

  const toggle = (id: string) =>
    setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const save = useMutation({
    mutationFn: async (payload: Partial<InventoryRow>) => {
      const row = { ...payload };
      if (!row.status) row.status = "in_use";
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

  const resetFilters = () => {
    setQ(""); setTab("all"); setDept("all"); setCpuMake("all"); setPrMake("all");
    setUpsMake("all"); setOs("all"); setDesg("all"); setStatusF("all");
  };

  return (
    <PageContainer>
      <PageHeader
        title="Inventory"
        subtitle={`${totalMatched} of ${inv.length} assets shown · ${visibleParents.length} primary holders`}
        actions={canEdit(role) && (
          <button onClick={openNew} className="rounded-lg bg-gradient-to-r from-electric to-cyan-glow text-navy-deep font-semibold px-4 py-2 text-sm flex items-center gap-2 hover:opacity-90">
            <Plus className="w-4 h-4" /> Add Asset
          </button>
        )}
      />

      <GlassCard className="p-4 mb-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {(["all","cpu","printer","scanner","ups"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`text-xs uppercase tracking-wider px-3 py-1.5 rounded-lg border transition ${
                tab === t
                  ? "bg-cyan-glow/15 border-cyan-glow text-cyan-glow"
                  : "border-border/60 text-muted-foreground hover:text-foreground hover:border-border"
              }`}>
              {t === "all" ? "All Assets" : `${t} only`}
            </button>
          ))}
          <div className="flex-1" />
          <button onClick={resetFilters} className="text-xs text-muted-foreground hover:text-cyan-glow underline underline-offset-4">Reset filters</button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, serial no, room, model…"
              className="w-full rounded-lg bg-input border border-border pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-cyan-glow" />
          </div>
          <FilterSel label="Dept" v={dept} on={setDept} opts={depts} />
          <FilterSel label="CPU" v={cpuMake} on={setCpuMake} opts={cpuBs} />
          <FilterSel label="Printer" v={prMake} on={setPrMake} opts={prBs} />
          <FilterSel label="UPS" v={upsMake} on={setUpsMake} opts={upsBs} />
          <FilterSel label="OS" v={os} on={setOs} opts={oses} />
          <FilterSel label="Desg." v={desg} on={setDesg} opts={desgs} />
          <FilterSel label="Status" v={statusF} on={setStatusF} opts={stats} />
        </div>
      </GlassCard>

      <GlassCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/40">
                <Th>{" "}</Th><Th>S/No</Th><Th>Name</Th><Th>Desg.</Th><Th>Room</Th>
                <Th>CPU</Th><Th>Printer</Th><Th>Scanner</Th><Th>UPS</Th>
                <Th>Windows</Th><Th>Status</Th><Th>{" "}</Th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={12} className="p-8 text-center text-muted-foreground">Loading…</td></tr>}
              {!isLoading && visibleParents.length === 0 && (
                <tr><td colSpan={12} className="p-12 text-center text-muted-foreground">No assets match your filter.</td></tr>
              )}
              {visibleParents.map((r) => {
                const kids = childrenByParent.get(r.id) ?? [];
                const isOpen = expanded.has(r.id);
                return (
                  <FragmentRow
                    key={r.id}
                    row={r}
                    hasKids={kids.length > 0}
                    open={isOpen}
                    onToggle={() => toggle(r.id)}
                    onEdit={openEdit}
                    onDelete={(id) => del.mutate(id)}
                    canEditRow={canEdit(role)}
                    canDeleteRow={canDelete(role)}
                    highlight={!!qq && matchesRow(r)}
                    childRows={isOpen ? kids : []}
                  />
                );
              })}
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

function FragmentRow({
  row, hasKids, open, onToggle, onEdit, onDelete, canEditRow, canDeleteRow, highlight, childRows,
}: {
  row: InventoryRow; hasKids: boolean; open: boolean; onToggle: () => void;
  onEdit: (r: InventoryRow) => void; onDelete: (id: string) => void;
  canEditRow: boolean; canDeleteRow: boolean; highlight: boolean; childRows: InventoryRow[];
}) {
  return (
    <>
      <DataRow
        row={row}
        expander={hasKids ? (
          <button onClick={onToggle} className="p-1 rounded hover:bg-white/10 text-cyan-glow">
            {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        ) : null}
        indent={0}
        onEdit={onEdit}
        onDelete={onDelete}
        canEditRow={canEditRow}
        canDeleteRow={canDeleteRow}
        highlight={highlight}
      />
      {childRows.map((c) => (
        <DataRow
          key={c.id} row={c} expander={null} indent={1}
          onEdit={onEdit} onDelete={onDelete}
          canEditRow={canEditRow} canDeleteRow={canDeleteRow} highlight={false}
        />
      ))}
    </>
  );
}

function DataRow({
  row, expander, indent, onEdit, onDelete, canEditRow, canDeleteRow, highlight,
}: {
  row: InventoryRow; expander: React.ReactNode; indent: number;
  onEdit: (r: InventoryRow) => void; onDelete: (id: string) => void;
  canEditRow: boolean; canDeleteRow: boolean; highlight: boolean;
}) {
  const kind = statusKind(row.status_text);
  const s = statusKindStyle[kind];
  const child = indent > 0;
  return (
    <motion.tr
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className={[
        "border-b border-border/20 hover:bg-white/[0.03] transition",
        child ? "bg-white/[0.015]" : "",
        highlight ? "ring-1 ring-cyan-glow/40" : "",
      ].join(" ")}
    >
      <Td>{expander}</Td>
      <Td className="text-muted-foreground">{row.s_no ?? "—"}</Td>
      <Td className={child ? "pl-8" : "font-medium"}>
        <div className="flex flex-col">
          <span className={child ? "text-muted-foreground text-xs" : ""}>
            {child && "↳ "}
            {row.name}
            {row.sub_assigned_to && !child && <span className="text-cyan-glow/80 text-xs"> ({row.sub_assigned_to})</span>}
          </span>
          {row.source_sheet && <span className="text-[10px] text-muted-foreground/60 uppercase">{row.source_sheet}</span>}
        </div>
      </Td>
      <Td className="text-xs">{row.designation || "—"}</Td>
      <Td className="text-xs">{row.room || "—"}</Td>
      <Td><TwoLine top={row.cpu_make} sub={row.cpu_model} serial={row.cpu_serial} /></Td>
      <Td><TwoLine top={row.printer_make} sub={row.printer_model} serial={row.printer_serial} /></Td>
      <Td><TwoLine top={row.scanner_make} sub={row.scanner_model} serial={row.scanner_serial} /></Td>
      <Td><TwoLine top={row.ups_make_model} sub={null} serial={row.ups_serial} /></Td>
      <Td className="text-xs">{row.windows_os || "—"}</Td>
      <Td>
        <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded border inline-flex items-center gap-1 ${s.cls}`}>
          {kind === "missing" && <AlertTriangle className="w-3 h-3" />}
          {row.status_text || s.label}
        </span>
      </Td>
      <Td>
        <div className="flex items-center gap-1 justify-end">
          {canEditRow && (
            <button onClick={() => onEdit(row)} className="p-2 rounded-md hover:bg-white/10 text-cyan-glow">
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          {canDeleteRow && (
            <button onClick={() => { if (confirm(`Delete ${row.name}?`)) onDelete(row.id); }}
              className="p-2 rounded-md hover:bg-destructive/20 text-destructive">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </Td>
    </motion.tr>
  );
}

function TwoLine({ top, sub, serial }: { top: string | null; sub: string | null; serial: string | null }) {
  if (!top && !sub && !serial) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="text-xs leading-tight">
      <div className="font-medium">{top || "—"}</div>
      {sub && <div className="text-muted-foreground">{sub}</div>}
      {serial && <div className="font-mono text-[10px] text-cyan-glow/80">{serial}</div>}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) { return <th className="px-3 py-3">{children}</th>; }
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-3 align-top ${className}`}>{children}</td>;
}

function FilterSel({ label, v, on, opts }: { label: string; v: string; on: (v: string) => void; opts: string[] }) {
  return (
    <select value={v} onChange={(e) => on(e.target.value)}
      className="rounded-lg bg-input border border-border px-2 py-2 text-xs focus:outline-none focus:border-cyan-glow max-w-[140px]">
      <option value="all">{label}: All</option>
      {opts.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function AssetDialog({ initial, cats: _cats, onClose, onSave, saving }: {
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
        className="glass-strong rounded-2xl p-6 w-full max-w-4xl my-8"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold">{f.id ? "Edit Asset" : "New Asset"}</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>

        <Section title="Assignment">
          <Inp label="Name *" v={f.name ?? ""} on={(v) => upd("name", v)} />
          <Inp label="Designation" v={f.designation ?? ""} on={(v) => upd("designation", v)} />
          <Inp label="Room No" v={f.room ?? ""} on={(v) => upd("room", v)} />
          <Inp label="Department" v={f.department ?? ""} on={(v) => upd("department", v)} />
          <Inp label="Sub-Assigned To" v={f.sub_assigned_to ?? ""} on={(v) => upd("sub_assigned_to", v)} />
          <Inp label="Source Sheet" v={f.source_sheet ?? ""} on={(v) => upd("source_sheet", v)} />
        </Section>

        <Section title="CPU">
          <Inp label="CPU Make" v={f.cpu_make ?? ""} on={(v) => upd("cpu_make", v)} />
          <Inp label="CPU Model" v={f.cpu_model ?? ""} on={(v) => upd("cpu_model", v)} />
          <Inp label="CPU Serial No" v={f.cpu_serial ?? ""} on={(v) => upd("cpu_serial", v)} />
        </Section>

        <Section title="Printer">
          <Inp label="Printer Make" v={f.printer_make ?? ""} on={(v) => upd("printer_make", v)} />
          <Inp label="Printer Model" v={f.printer_model ?? ""} on={(v) => upd("printer_model", v)} />
          <Inp label="Printer Serial No" v={f.printer_serial ?? ""} on={(v) => upd("printer_serial", v)} />
        </Section>

        <Section title="Scanner">
          <Inp label="Scanner Make" v={f.scanner_make ?? ""} on={(v) => upd("scanner_make", v)} />
          <Inp label="Scanner Model" v={f.scanner_model ?? ""} on={(v) => upd("scanner_model", v)} />
          <Inp label="Scanner Serial No" v={f.scanner_serial ?? ""} on={(v) => upd("scanner_serial", v)} />
        </Section>

        <Section title="UPS & OS">
          <Inp label="UPS Make/Model" v={f.ups_make_model ?? ""} on={(v) => upd("ups_make_model", v)} />
          <Inp label="UPS Serial No" v={f.ups_serial ?? ""} on={(v) => upd("ups_serial", v)} />
          <Inp label="Windows OS" v={f.windows_os ?? ""} on={(v) => upd("windows_os", v)} />
          <Inp label="Status" v={f.status_text ?? ""} on={(v) => upd("status_text", v)} />
        </Section>

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-white/5">Cancel</button>
          <button onClick={() => onSave(f)} disabled={saving || !f.name}
            className="rounded-lg bg-gradient-to-r from-electric to-cyan-glow text-navy-deep font-semibold px-5 py-2 text-sm flex items-center gap-2 disabled:opacity-50">
            <Save className="w-4 h-4" /> {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="text-[10px] uppercase tracking-wider text-cyan-glow/80 mb-2">{title}</div>
      <div className="grid grid-cols-3 gap-3">{children}</div>
    </div>
  );
}

function Inp({ label, v, on, type = "text" }: { label: string; v: string; on: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">{label}</label>
      <input type={type} value={v} onChange={(e) => on(e.target.value)}
        className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:border-cyan-glow" />
    </div>
  );
}
