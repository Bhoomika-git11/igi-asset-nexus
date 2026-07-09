import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, Pencil, Trash2, X, Save, Send, FilterX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchCategories,
  fetchInventory,
  na,
  statusColors,
  statusLabel,
  type AssetStatus,
  type InventoryRow,
} from "@/lib/inventory-api";
import { ASSET_CATEGORIES, DEPARTMENTS, WINDOWS_OS_OPTIONS, CPU_MAKES } from "@/lib/asset-categories";
import { PageContainer, PageHeader, GlassCard } from "@/components/PageChrome";
import { canDelete, canEdit, canRequest, useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/inventory")({ component: InventoryPage });

const emptyForm: Partial<InventoryRow> = {
  asset_tag: "", name: "", category_id: null, category_name: "",
  department: "", room: "", assigned_to: "", status: "in_store",
  serial_number: "", manufacturer: "", model: "",
  purchase_date: null, purchase_cost: 0, warranty_expiry: null, notes: "",
  designation: "", cpu_make: "", cpu_model: "", cpu_serial: "",
  printer_make: "", printer_model: "", printer_serial: "",
  ups_make_model: "", ups_serial: "", windows_os: "",
};

function InventoryPage() {
  const { role, user } = useAuth();
  const qc = useQueryClient();
  const { data: inv = [], isLoading } = useQuery({ queryKey: ["inventory"], queryFn: fetchInventory });
  const { data: cats = [] } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<AssetStatus | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [roomFilter, setRoomFilter] = useState("all");
  const [assignedFilter, setAssignedFilter] = useState("");
  const [osFilter, setOsFilter] = useState("all");
  const [cpuMakeFilter, setCpuMakeFilter] = useState("all");
  const [page, setPage] = useState(1);
  const PER_PAGE = 25;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<InventoryRow>>(emptyForm);

  const uniq = (arr: (string | null)[]) =>
    Array.from(new Set(arr.map((v) => (v ?? "").trim()).filter(Boolean))).sort();
  const rooms = useMemo(() => uniq(inv.map((r) => r.room)), [inv]);

  const filtered = useMemo(() => {
    const qq = q.toLowerCase().trim();
    const assignedQ = assignedFilter.toLowerCase().trim();
    return inv.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (categoryFilter !== "all" && (r.category_name ?? "") !== categoryFilter) return false;
      if (departmentFilter !== "all" && (r.department ?? "") !== departmentFilter) return false;
      if (roomFilter !== "all" && (r.room ?? "") !== roomFilter) return false;
      if (osFilter !== "all" && (r.windows_os ?? "").toLowerCase() !== osFilter.toLowerCase()) return false;
      if (cpuMakeFilter !== "all" && (r.cpu_make ?? "").toUpperCase() !== cpuMakeFilter.toUpperCase()) return false;
      if (assignedQ) {
        const person = `${r.assigned_to ?? ""} ${r.name ?? ""} ${r.sub_assigned_to ?? ""}`.toLowerCase();
        if (!person.includes(assignedQ)) return false;
      }
      if (qq) {
        const hay = [
          r.asset_tag, r.name, r.department, r.room, r.assigned_to,
          r.serial_number, r.category_name, r.manufacturer, r.model,
          r.designation, r.cpu_make, r.cpu_model, r.cpu_serial,
          r.printer_make, r.printer_model, r.printer_serial,
          r.scanner_serial, r.ups_make_model, r.ups_serial, r.windows_os, r.notes,
        ].map((v) => (v ?? "").toLowerCase()).join(" | ");
        if (!hay.includes(qq)) return false;
      }
      return true;
    });
  }, [inv, q, statusFilter, categoryFilter, departmentFilter, roomFilter, assignedFilter, osFilter, cpuMakeFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const pageRows = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const resetPage = () => setPage(1);
  const clearFilters = () => {
    setQ(""); setStatusFilter("all"); setCategoryFilter("all");
    setDepartmentFilter("all"); setRoomFilter("all"); setAssignedFilter("");
    setOsFilter("all"); setCpuMakeFilter("all");
    resetPage();
  };

  // Admin: direct write. Manager: submit approval request.
  const save = useMutation({
    mutationFn: async (payload: Partial<InventoryRow>) => {
      const cat = cats.find((c) => c.id === payload.category_id);
      const row = { ...payload, category_name: cat?.name ?? payload.category_name ?? null };

      if (role === "admin") {
        if (row.id) {
          const { error } = await supabase.from("inventory").update(row as never).eq("id", row.id);
          if (error) throw error;
        } else {
          const { id: _ignored, ...insertRow } = row as Record<string, unknown> & { id?: string };
          const { error } = await supabase.from("inventory").insert(insertRow as never);
          if (error) throw error;
        }
        return { approved: true as const };
      }

      // Manager path — submit approval request
      const req = {
        request_type: row.id ? "update_asset" : "create_asset",
        target_id: row.id ?? null,
        payload: row as never,
        summary: row.id
          ? `Update asset ${row.asset_tag ?? row.id}`
          : `Create asset ${row.asset_tag ?? row.name ?? ""}`.trim(),
        requested_by: user?.id,
        requested_by_email: user?.email,
      };
      const { error } = await supabase.from("approval_requests" as never).insert(req as never);
      if (error) throw error;
      return { approved: false as const };
    },
    onSuccess: (res) => {
      if (res.approved) {
        qc.invalidateQueries({ queryKey: ["inventory"] });
        toast.success("Saved");
      } else {
        qc.invalidateQueries({ queryKey: ["approval_requests"] });
        toast.success("Sent to admin for approval");
      }
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (r: InventoryRow) => {
      if (role === "admin") {
        const { error } = await supabase.from("inventory").delete().eq("id", r.id);
        if (error) throw error;
        return { approved: true as const };
      }
      const req = {
        request_type: "delete_asset",
        target_id: r.id,
        payload: { asset_tag: r.asset_tag, name: r.name } as never,
        summary: `Delete asset ${r.asset_tag ?? r.name ?? r.id}`,
        requested_by: user?.id,
        requested_by_email: user?.email,
      };
      const { error } = await supabase.from("approval_requests" as never).insert(req as never);
      if (error) throw error;
      return { approved: false as const };
    },
    onSuccess: (res) => {
      if (res.approved) { qc.invalidateQueries({ queryKey: ["inventory"] }); toast.success("Deleted"); }
      else { qc.invalidateQueries({ queryKey: ["approval_requests"] }); toast.success("Deletion sent for approval"); }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => { setEditing(emptyForm); setOpen(true); };
  const openEdit = (r: InventoryRow) => { setEditing(r); setOpen(true); };

  const showAdd = canEdit(role) || canRequest(role);
  const showEdit = canEdit(role) || canRequest(role);
  const showDelete = canDelete(role) || canRequest(role);

  return (
    <PageContainer>
      <PageHeader
        title="Inventory"
        subtitle={`${filtered.length} of ${inv.length} assets shown${canRequest(role) ? " · Manager actions are sent to admin for approval" : ""}`}
        actions={
          showAdd && (
            <button
              onClick={openNew}
              className="rounded-lg bg-gradient-to-r from-electric to-cyan-glow text-navy-deep font-semibold px-4 py-2 text-sm flex items-center gap-2 hover:opacity-90"
            >
              {canRequest(role) ? <Send className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {canRequest(role) ? "Request Asset" : "Add Asset"}
            </button>
          )
        }
      />

      {/* Filters */}
      <GlassCard className="p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); resetPage(); }}
              placeholder="Search name, serial, room…"
              className="w-full rounded-lg bg-input border border-border pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:border-cyan-glow"
            />
          </div>
          <FilterSelect label="Status" value={statusFilter} onChange={(v) => { setStatusFilter(v as AssetStatus | "all"); resetPage(); }}
            options={[{ v: "all", l: "All statuses" }, ...(["in_use", "in_store", "faulty", "retired"] as const).map((s) => ({ v: s, l: statusLabel[s] }))]} />
          <FilterSelect label="Category" value={categoryFilter} onChange={(v) => { setCategoryFilter(v); resetPage(); }}
            options={[{ v: "all", l: "All categories" }, ...ASSET_CATEGORIES.map((c) => ({ v: c, l: c }))]} />
          <FilterSelect label="Department" value={departmentFilter} onChange={(v) => { setDepartmentFilter(v); resetPage(); }}
            options={[{ v: "all", l: "All departments" }, ...DEPARTMENTS.map((d) => ({ v: d, l: d }))]} />
          <FilterSelect label="Room" value={roomFilter} onChange={(v) => { setRoomFilter(v); resetPage(); }}
            options={[{ v: "all", l: "All rooms" }, ...rooms.map((r) => ({ v: r, l: r }))]} />
          <FilterSelect label="Windows OS" value={osFilter} onChange={(v) => { setOsFilter(v); resetPage(); }}
            options={[{ v: "all", l: "All OS" }, ...WINDOWS_OS_OPTIONS.map((o) => ({ v: o, l: o }))]} />
          <FilterSelect label="CPU Make" value={cpuMakeFilter} onChange={(v) => { setCpuMakeFilter(v); resetPage(); }}
            options={[{ v: "all", l: "All makes" }, ...CPU_MAKES.map((m) => ({ v: m, l: m }))]} />
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Assigned To</label>
            <input
              value={assignedFilter}
              onChange={(e) => { setAssignedFilter(e.target.value); resetPage(); }}
              placeholder="Search person…"
              className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:border-cyan-glow"
            />
          </div>
          <button onClick={clearFilters}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-white/[0.02] hover:bg-white/[0.06] text-xs text-muted-foreground py-2.5 transition">
            <FilterX className="w-3.5 h-3.5" /> Clear
          </button>
        </div>
      </GlassCard>

      <GlassCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border/40">
                <Th>#</Th><Th>Tag</Th><Th>Assigned To</Th><Th>Designation</Th>
                <Th>Department</Th><Th>Room</Th><Th>CPU</Th><Th>Printer</Th>
                <Th>UPS</Th><Th>OS</Th><Th>Status</Th><Th> </Th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (<tr><td colSpan={12} className="p-8 text-center text-muted-foreground">Loading…</td></tr>)}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={12} className="p-12 text-center text-muted-foreground">No assets match your filter.</td></tr>
              )}
              {pageRows.map((r, i) => (
                <motion.tr
                  key={r.id}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i * 0.01, 0.3) }}
                  className="border-b border-border/20 hover:bg-white/[0.03] transition align-top"
                >
                  <Td className="text-muted-foreground text-xs">{(page - 1) * PER_PAGE + i + 1}</Td>
                  <Td className="font-mono text-cyan-glow text-xs whitespace-nowrap">{na(r.asset_tag)}</Td>
                  <Td className="font-medium max-w-[140px]">
                    <div className="truncate" title={r.assigned_to ?? r.name}>{na(r.assigned_to || r.name)}</div>
                    {r.sub_assigned_to && <div className="text-[10px] text-muted-foreground truncate">↳ {r.sub_assigned_to}</div>}
                  </Td>
                  <Td className="text-muted-foreground text-xs">{na(r.designation)}</Td>
                  <Td className="text-xs">{na(r.department)}</Td>
                  <Td className="text-xs">{na(r.room)}</Td>
                  <Td className="max-w-[160px]">
                    {r.cpu_make || r.cpu_model || r.cpu_serial ? (
                      <>
                        <div className="text-xs truncate" title={`${r.cpu_make ?? ""} ${r.cpu_model ?? ""}`}>
                          {[r.cpu_make, r.cpu_model].filter(Boolean).join(" ") || "Not Available"}
                        </div>
                        {r.cpu_serial && <div className="text-[9px] font-mono text-cyan-glow/70 truncate">{r.cpu_serial}</div>}
                      </>
                    ) : <span className="text-muted-foreground text-xs">Not Available</span>}
                  </Td>
                  <Td className="max-w-[150px]">
                    {r.printer_make || r.printer_model || r.printer_serial ? (
                      <>
                        <div className="text-xs truncate" title={`${r.printer_make ?? ""} ${r.printer_model ?? ""}`}>
                          {[r.printer_make, r.printer_model].filter(Boolean).join(" ") || "Not Available"}
                        </div>
                        {r.printer_serial && <div className="text-[9px] font-mono text-cyan-glow/70 truncate">{r.printer_serial}</div>}
                      </>
                    ) : <span className="text-muted-foreground text-xs">Not Available</span>}
                  </Td>
                  <Td className="max-w-[120px] text-xs">
                    <div className="truncate" title={r.ups_make_model ?? ""}>{na(r.ups_make_model)}</div>
                    {r.ups_serial && <div className="text-[9px] font-mono text-cyan-glow/70 truncate">{r.ups_serial}</div>}
                  </Td>
                  <Td className="text-xs text-muted-foreground max-w-[90px]"><div className="truncate">{na(r.windows_os)}</div></Td>
                  <Td>
                    <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded border ${statusColors[r.status]}`}>
                      {statusLabel[r.status]}
                    </span>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1 justify-end">
                      {showEdit && (
                        <IconBtn onClick={() => openEdit(r)} title={canRequest(role) ? "Request edit" : "Edit"}>
                          <Pencil className="w-3.5 h-3.5" />
                        </IconBtn>
                      )}
                      {showDelete && (
                        <IconBtn
                          danger
                          title={canRequest(role) ? "Request delete" : "Delete"}
                          onClick={() => {
                            const msg = canRequest(role)
                              ? `Send delete request for ${r.asset_tag ?? r.name} to admin?`
                              : `Delete ${r.asset_tag ?? r.name}?`;
                            if (confirm(msg)) del.mutate(r);
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </IconBtn>
                      )}
                    </div>
                  </Td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="p-4 border-t border-border/40 flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="text-muted-foreground text-xs">
              Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length}
            </div>
            <div className="flex gap-1 flex-wrap">
              <PageBtn disabled={page === 1} onClick={() => setPage((p) => p - 1)}>← Prev</PageBtn>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, idx) => {
                const pg = idx + 1;
                return <PageBtn key={pg} active={pg === page} onClick={() => setPage(pg)}>{pg}</PageBtn>;
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
            role={role}
            onClose={() => setOpen(false)}
            onSave={(v) => save.mutate(v)}
            saving={save.isPending}
          />
        )}
      </AnimatePresence>
    </PageContainer>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 whitespace-nowrap">{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}
function IconBtn({ children, onClick, danger, title }: { children: React.ReactNode; onClick: () => void; danger?: boolean; title?: string }) {
  return (
    <button
      onClick={onClick} title={title}
      className={`p-2 rounded-md transition ${danger ? "hover:bg-destructive/20 text-destructive" : "hover:bg-white/10 text-cyan-glow"}`}
    >
      {children}
    </button>
  );
}
function PageBtn({ children, onClick, disabled, active }: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean; active?: boolean;
}) {
  return (
    <button
      onClick={onClick} disabled={disabled}
      className={`px-3 py-1.5 rounded-lg text-xs transition ${
        active ? "bg-cyan-glow text-navy-deep font-bold"
          : "bg-white/5 hover:bg-white/10 text-muted-foreground disabled:opacity-30"
      }`}
    >
      {children}
    </button>
  );
}

function FilterSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { v: string; l: string }[];
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{label}</div>
      <select
        value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:border-cyan-glow"
      >
        {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );
}

function AssetDialog({
  initial, cats, role, onClose, onSave, saving,
}: {
  initial: Partial<InventoryRow>;
  cats: { id: string; name: string }[];
  role: string | null;
  onClose: () => void;
  onSave: (v: Partial<InventoryRow>) => void;
  saving: boolean;
}) {
  const [f, setF] = useState<Partial<InventoryRow>>(initial);
  const upd = <K extends keyof InventoryRow>(k: K, v: InventoryRow[K] | null) =>
    setF((s) => ({ ...s, [k]: v }));

  const isManager = role === "manager";
  const title = f.id ? (isManager ? "Request Asset Update" : "Edit Asset") : (isManager ? "Request New Asset" : "New Asset");

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
          <div>
            <h3 className="text-xl font-bold">{title}</h3>
            {isManager && (
              <p className="text-xs text-cyan-glow/80 mt-1">
                This will be submitted for admin approval, not applied directly.
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Inp label="Asset Tag *" v={f.asset_tag ?? ""} on={(v) => upd("asset_tag", v)} />
          <Inp label="Assigned To *" v={f.assigned_to ?? ""} on={(v) => upd("assigned_to", v)} />
          <Inp label="Name / Description" v={f.name ?? ""} on={(v) => upd("name", v)} />
          <Sel label="Status" v={f.status ?? "in_store"} on={(v) => upd("status", v as AssetStatus)}
            opts={(["in_use", "in_store", "faulty", "retired"] as const).map((s) => ({ v: s, l: statusLabel[s] }))} />
          <Inp label="Department" v={f.department ?? ""} on={(v) => upd("department", v)} />
          <Inp label="Room / Location" v={f.room ?? ""} on={(v) => upd("room", v)} />
          <Inp label="Designation" v={f.designation ?? ""} on={(v) => upd("designation", v)} />
          <Sel label="Category" v={f.category_id ?? ""} on={(v) => upd("category_id", v || null)}
            opts={[{ v: "", l: "—" }, ...cats.map((c) => ({ v: c.id, l: c.name }))]} />
          <Inp label="CPU Make" v={f.cpu_make ?? ""} on={(v) => upd("cpu_make", v)} />
          <Inp label="CPU Model" v={f.cpu_model ?? ""} on={(v) => upd("cpu_model", v)} />
          <Inp label="CPU Serial" v={f.cpu_serial ?? ""} on={(v) => upd("cpu_serial", v)} />
          <Inp label="Windows OS" v={f.windows_os ?? ""} on={(v) => upd("windows_os", v)} />
          <Inp label="Printer Make" v={f.printer_make ?? ""} on={(v) => upd("printer_make", v)} />
          <Inp label="Printer Model" v={f.printer_model ?? ""} on={(v) => upd("printer_model", v)} />
          <Inp label="Printer Serial" v={f.printer_serial ?? ""} on={(v) => upd("printer_serial", v)} />
          <Inp label="UPS Make / Model" v={f.ups_make_model ?? ""} on={(v) => upd("ups_make_model", v)} />
          <Inp label="UPS Serial" v={f.ups_serial ?? ""} on={(v) => upd("ups_serial", v)} />
          <Inp label="Purchase Date" type="date" v={f.purchase_date ?? ""} on={(v) => upd("purchase_date", v || null)} />
          <Inp label="Purchase Cost (₹)" type="number" v={String(f.purchase_cost ?? "")} on={(v) => upd("purchase_cost", v ? Number(v) : 0)} />
          <div className="col-span-2">
            <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Notes / Remarks</label>
            <textarea
              value={f.notes ?? ""} onChange={(e) => upd("notes", e.target.value)}
              className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:border-cyan-glow"
              rows={3}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-white/5">Cancel</button>
          <button
            onClick={() => onSave(f)}
            disabled={saving || !f.asset_tag}
            className="rounded-lg bg-gradient-to-r from-electric to-cyan-glow text-navy-deep font-semibold px-5 py-2 text-sm flex items-center gap-2 disabled:opacity-50"
          >
            {isManager ? <Send className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saving ? "Submitting…" : (isManager ? "Send for Approval" : "Save")}
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
