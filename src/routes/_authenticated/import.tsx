import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader, GlassCard } from "@/components/PageChrome";
import { canEdit, useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import type { AssetStatus } from "@/lib/inventory-api";

export const Route = createFileRoute("/_authenticated/import")({ component: ImportPage });

interface ParsedRow {
  asset_tag?: string; name?: string; category_name?: string;
  department?: string; room?: string; assigned_to?: string;
  status?: string; serial_number?: string; manufacturer?: string; model?: string;
  purchase_date?: string; purchase_cost?: number; warranty_expiry?: string; notes?: string;
}

function normalizeStatus(s?: string): AssetStatus {
  const v = (s ?? "").toLowerCase().replace(/\s+/g, "_");
  if (v === "in_use" || v === "in_store" || v === "faulty" || v === "retired") return v;
  return "in_store";
}

function ImportPage() {
  const { role } = useAuth();
  const qc = useQueryClient();
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [file, setFile] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [loading, setLoading] = useState(false);
  const [imported, setImported] = useState(0);

  const parseFile = async (f: File) => {
    const buf = await f.arrayBuffer();
    const wb = XLSX.read(buf);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<ParsedRow>(sheet, { defval: "" });
    setRows(json);
    setFile(f.name);
    setImported(0);
    toast.success(`Parsed ${json.length} rows from ${f.name}`);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer.files?.[0]; if (f) parseFile(f);
  };

  const doImport = async () => {
    if (!canEdit(role)) { toast.error("Insufficient permission"); return; }
    setLoading(true);
    try {
      // Load categories for name→id resolution
      const { data: cats } = await supabase.from("categories").select("id,name");
      const catMap = new Map((cats ?? []).map((c) => [c.name.toLowerCase(), c.id]));
      const payload = rows.filter((r) => r.asset_tag && r.name).map((r) => ({
        asset_tag: String(r.asset_tag), name: String(r.name),
        category_id: catMap.get(String(r.category_name ?? "").toLowerCase()) ?? null,
        category_name: r.category_name ?? null,
        department: r.department ?? "", room: r.room ?? "", assigned_to: r.assigned_to ?? "",
        status: normalizeStatus(r.status),
        serial_number: r.serial_number ?? "", manufacturer: r.manufacturer ?? "", model: r.model ?? "",
        purchase_date: r.purchase_date || null, purchase_cost: Number(r.purchase_cost ?? 0) || 0,
        warranty_expiry: r.warranty_expiry || null, notes: r.notes ?? "",
      }));
      const { error } = await supabase.from("inventory").upsert(payload as never, { onConflict: "asset_tag" });
      if (error) throw error;
      setImported(payload.length);
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast.success(`Imported ${payload.length} assets`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Import failed";
      toast.error(msg);
    } finally { setLoading(false); }
  };

  const downloadTemplate = () => {
    const template = [{
      asset_tag: "IGI-001", name: "Dell Latitude 5540", category_name: "Laptop",
      department: "Terminal 3 IT", room: "T3-IT-01", assigned_to: "Amit Kumar",
      status: "in_use", serial_number: "SN123", manufacturer: "Dell", model: "5540",
      purchase_date: "2024-01-15", purchase_cost: 75000, warranty_expiry: "2027-01-15", notes: "",
    }];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    XLSX.writeFile(wb, "igi-inventory-template.xlsx");
  };

  return (
    <PageContainer>
      <PageHeader title="Excel Import" subtitle="Drop an .xlsx file to bulk-import assets. Existing assets with the same tag will be updated."
        actions={<button onClick={downloadTemplate} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-white/5">Download template</button>} />

      <div className={`glass rounded-2xl p-12 mb-6 border-2 border-dashed transition ${drag ? "border-cyan-glow bg-cyan-glow/5" : "border-border/60"}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
      >
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-electric to-cyan-glow flex items-center justify-center mb-4 animate-pulse-glow">
            <Upload className="w-8 h-8 text-navy-deep" />
          </div>
          <h3 className="text-lg font-semibold">Drop your Excel file here</h3>
          <p className="text-sm text-muted-foreground mt-1">or click to browse (.xlsx, .xls, .csv)</p>
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" id="fileup"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) parseFile(f); }} />
          <label htmlFor="fileup" className="mt-4 cursor-pointer rounded-lg bg-primary/80 hover:bg-primary text-primary-foreground px-5 py-2 text-sm font-medium">Choose file</label>
          {file && <div className="mt-4 text-xs text-cyan-glow flex items-center gap-2"><FileSpreadsheet className="w-4 h-4" /> {file} · {rows.length} rows</div>}
        </div>
      </GlassCard>

      {rows.length > 0 && (
        <GlassCard className="overflow-hidden">
          <div className="p-4 flex items-center justify-between border-b border-border/40">
            <div className="text-sm">Preview: <span className="text-cyan-glow font-semibold">{rows.length}</span> rows</div>
            <button onClick={doImport} disabled={loading || !canEdit(role)} className="rounded-lg bg-gradient-to-r from-electric to-cyan-glow text-navy-deep font-semibold px-5 py-2 text-sm flex items-center gap-2 disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {loading ? "Importing…" : `Import ${rows.length} rows`}
            </button>
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-navy-deep/95">
                <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  {["asset_tag", "name", "category_name", "department", "room", "status"].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 100).map((r, i) => (
                  <tr key={i} className="border-t border-border/20">
                    <td className="px-3 py-2 font-mono text-cyan-glow">{r.asset_tag}</td>
                    <td className="px-3 py-2">{r.name}</td>
                    <td className="px-3 py-2">{r.category_name}</td>
                    <td className="px-3 py-2">{r.department}</td>
                    <td className="px-3 py-2">{r.room}</td>
                    <td className="px-3 py-2">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 100 && <div className="p-3 text-xs text-muted-foreground text-center">…and {rows.length - 100} more</div>}
          </div>
          {imported > 0 && <div className="p-3 border-t border-border/40 text-emerald-400 text-sm flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Imported {imported} rows successfully.</div>}
        </GlassCard>
      )}
    </PageContainer>
  );
}
