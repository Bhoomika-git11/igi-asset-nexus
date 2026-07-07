import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader, GlassCard } from "@/components/PageChrome";
import { canEdit, useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import type { InventoryRow } from "@/lib/inventory-api";

export const Route = createFileRoute("/_authenticated/import")({ component: ImportPage });

type Draft = Omit<Partial<InventoryRow>, "id" | "created_at" | "updated_at" | "parent_id"> & {
  __base_name?: string;   // used to link children to parents in the same sheet
  __is_child?: boolean;
  __sheet?: string;
};

/** Case-insensitive header lookup — the survey headers include trailing spaces and mixed case. */
const H = {
  s_no:            ["s/no", "sno", "s.no", "s_no", "sr no", "sr.no"],
  name:            ["name"],
  designation:     ["degn.", "degn", "designation"],
  room:            ["room no", "room", "room no.", "roomno"],
  cpu_make:        ["cpu make", "cpu mfg"],
  cpu_model:       ["cpu model"],
  cpu_serial:      ["cpu serial no", "cpu serial", "cpu sn"],
  printer_make:    ["printer make"],
  printer_model:   ["printer model"],
  printer_serial:  ["printer serial no", "printer serial", "printer sn"],
  scanner_make:    ["scanner make"],
  scanner_model:   ["scanner model"],
  scanner_serial:  ["scanner serial no", "scanner serial", "scanner sn"],
  ups_make_model:  ["ups make/model", "ups make", "ups model", "ups make / model"],
  ups_serial:      ["ups serial no", "ups serial", "ups sn"],
  windows_os:      ["window", "windows", "windows os", "os"],
  status_text:     ["status", "remark", "remarks"],
} as const;

function norm(s: unknown) { return String(s ?? "").trim().toLowerCase(); }

/** Locate the header row (row with "Name" AND "S/No") in a sheet and return {headerRowIndex, indexMap}. */
function findHeader(rows: unknown[][]): { hdr: number; map: Record<keyof typeof H, number> } | null {
  for (let r = 0; r < Math.min(rows.length, 20); r++) {
    const cells = rows[r].map(norm);
    const idx = {} as Record<keyof typeof H, number>;
    let matched = 0;
    (Object.keys(H) as (keyof typeof H)[]).forEach((k) => {
      const aliases = H[k];
      const i = cells.findIndex((c) => aliases.some((a) => c === a));
      idx[k] = i;
      if (i >= 0) matched++;
    });
    if (idx.name >= 0 && matched >= 4) return { hdr: r, map: idx };
  }
  return null;
}

/** Split names like "MEETU JAIN (POOJA)" or "MEETU JAIN - POOJA" into {base, sub}. */
function splitName(raw: string): { base: string; sub: string | null } {
  const s = raw.trim();
  const paren = s.match(/^(.+?)\s*[\(\[]\s*(.+?)\s*[\)\]]\s*$/);
  if (paren) return { base: paren[1].trim(), sub: paren[2].trim() };
  const dash = s.match(/^(.+?)\s+[-–]\s+(.+)$/);
  if (dash) return { base: dash[1].trim(), sub: dash[2].trim() };
  return { base: s, sub: null };
}

function cell(row: unknown[], i: number): string {
  if (i < 0) return "";
  const v = row[i];
  return v === null || v === undefined ? "" : String(v).trim();
}

function parseSheet(sheetName: string, rows: unknown[][]): Draft[] {
  const found = findHeader(rows);
  if (!found) return [];
  const { hdr, map } = found;
  const out: Draft[] = [];
  for (let r = hdr + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every((c) => c === null || c === undefined || String(c).trim() === "")) continue;
    const rawName = cell(row, map.name);
    if (!rawName) continue;
    const { base, sub } = splitName(rawName);
    const sNoRaw = cell(row, map.s_no);
    const sNo = Number(sNoRaw);
    out.push({
      s_no: Number.isFinite(sNo) ? sNo : null,
      name: base,
      sub_assigned_to: sub,
      designation: cell(row, map.designation) || null,
      room: cell(row, map.room) || null,
      cpu_make: cell(row, map.cpu_make) || null,
      cpu_model: cell(row, map.cpu_model) || null,
      cpu_serial: cell(row, map.cpu_serial) || null,
      printer_make: cell(row, map.printer_make) || null,
      printer_model: cell(row, map.printer_model) || null,
      printer_serial: cell(row, map.printer_serial) || null,
      scanner_make: cell(row, map.scanner_make) || null,
      scanner_model: cell(row, map.scanner_model) || null,
      scanner_serial: cell(row, map.scanner_serial) || null,
      ups_make_model: cell(row, map.ups_make_model) || null,
      ups_serial: cell(row, map.ups_serial) || null,
      windows_os: cell(row, map.windows_os) || null,
      status_text: cell(row, map.status_text) || null,
      source_sheet: sheetName.trim(),
      status: "in_use",
      __base_name: base,
      __is_child: !!sub,
      __sheet: sheetName.trim(),
    });
  }
  return out;
}

function ImportPage() {
  const { role } = useAuth();
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [sheetSummary, setSheetSummary] = useState<{ sheet: string; count: number }[]>([]);
  const [drag, setDrag] = useState(false);
  const [loading, setLoading] = useState(false);
  const [imported, setImported] = useState(0);
  const [replaceExisting, setReplaceExisting] = useState(true);

  const parseFile = async (f: File) => {
    const buf = await f.arrayBuffer();
    const wb = XLSX.read(buf, { cellDates: false });
    const all: Draft[] = [];
    const summary: { sheet: string; count: number }[] = [];
    for (const name of wb.SheetNames) {
      const sheet = wb.Sheets[name];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
      const parsed = parseSheet(name, rows);
      if (parsed.length) {
        all.push(...parsed);
        summary.push({ sheet: name.trim(), count: parsed.length });
      }
    }
    setDrafts(all);
    setSheetSummary(summary);
    setFileName(f.name);
    setImported(0);
    if (!all.length) toast.error("No importable rows found — check header row (Name, S/No).");
    else toast.success(`Parsed ${all.length} rows from ${summary.length} sheets`);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer.files?.[0]; if (f) parseFile(f);
  };

  const doImport = async () => {
    if (!canEdit(role)) { toast.error("Insufficient permission"); return; }
    if (!drafts.length) return;
    setLoading(true);
    try {
      const sheets = Array.from(new Set(drafts.map((d) => d.__sheet ?? "").filter(Boolean)));

      if (replaceExisting && sheets.length) {
        const { error: delErr } = await supabase.from("inventory").delete().in("source_sheet", sheets);
        if (delErr) throw delErr;
      }

      // Insert parents first (rows with no sub_assigned_to). Then children with parent_id lookup.
      const parents = drafts.filter((d) => !d.__is_child).map((d) => {
        const { __base_name, __is_child, __sheet, ...clean } = d; void __base_name; void __is_child; void __sheet;
        return clean;
      });
      let parentInserted: { id: string; name: string; source_sheet: string | null }[] = [];
      if (parents.length) {
        const { data, error } = await supabase.from("inventory").insert(parents as never).select("id,name,source_sheet");
        if (error) throw error;
        parentInserted = (data ?? []) as typeof parentInserted;
      }

      // Build lookup: sheet + base_name -> parent id (latest occurrence wins if duplicates).
      const parentMap = new Map<string, string>();
      for (const p of parentInserted) parentMap.set(`${p.source_sheet ?? ""}::${p.name}`, p.id);

      const kids = drafts.filter((d) => d.__is_child).map((d) => {
        const key = `${d.__sheet ?? ""}::${d.__base_name ?? d.name ?? ""}`;
        const parent_id = parentMap.get(key) ?? null;
        const { __base_name, __is_child, __sheet, ...clean } = d; void __base_name; void __is_child; void __sheet;
        return { ...clean, parent_id };
      });
      if (kids.length) {
        const { error } = await supabase.from("inventory").insert(kids as never);
        if (error) throw error;
      }

      const total = parents.length + kids.length;
      setImported(total);
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast.success(`Imported ${total} rows across ${sheets.length} sheets`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Import failed";
      toast.error(msg);
    } finally { setLoading(false); }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Excel Import"
        subtitle="Upload the survey workbook — every sheet is parsed and imported with sub-assignments preserved."
      />

      <div
        className={`glass rounded-2xl p-10 mb-6 border-2 border-dashed transition ${drag ? "border-cyan-glow bg-cyan-glow/5" : "border-border/60"}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
      >
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-electric to-cyan-glow flex items-center justify-center mb-4 animate-pulse-glow">
            <Upload className="w-8 h-8 text-navy-deep" />
          </div>
          <h3 className="text-lg font-semibold">Drop the survey Excel file here</h3>
          <p className="text-sm text-muted-foreground mt-1">All sheets are parsed automatically (.xlsx / .xls)</p>
          <input type="file" accept=".xlsx,.xls" className="hidden" id="fileup"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) parseFile(f); }} />
          <label htmlFor="fileup" className="mt-4 cursor-pointer rounded-lg bg-primary/80 hover:bg-primary text-primary-foreground px-5 py-2 text-sm font-medium">Choose file</label>
          {fileName && (
            <div className="mt-4 text-xs text-cyan-glow flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4" /> {fileName} · {drafts.length} rows
            </div>
          )}
        </div>
      </div>

      {sheetSummary.length > 0 && (
        <GlassCard className="p-4 mb-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Sheets detected</div>
          <div className="flex flex-wrap gap-2">
            {sheetSummary.map((s) => (
              <span key={s.sheet} className="text-xs px-3 py-1 rounded-lg bg-white/5 border border-border/40">
                {s.sheet} <span className="text-cyan-glow ml-1">{s.count}</span>
              </span>
            ))}
          </div>
        </GlassCard>
      )}

      {drafts.length > 0 && (
        <GlassCard className="overflow-hidden">
          <div className="p-4 flex items-center justify-between border-b border-border/40 flex-wrap gap-3">
            <div className="flex items-center gap-4">
              <div className="text-sm">Preview: <span className="text-cyan-glow font-semibold">{drafts.length}</span> rows</div>
              <label className="text-xs flex items-center gap-2 text-muted-foreground">
                <input type="checkbox" checked={replaceExisting} onChange={(e) => setReplaceExisting(e.target.checked)} />
                Replace existing rows in these sheets
              </label>
            </div>
            <button onClick={doImport} disabled={loading || !canEdit(role)}
              className="rounded-lg bg-gradient-to-r from-electric to-cyan-glow text-navy-deep font-semibold px-5 py-2 text-sm flex items-center gap-2 disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {loading ? "Importing…" : `Import ${drafts.length} rows`}
            </button>
          </div>
          {!canEdit(role) && (
            <div className="p-3 border-b border-border/40 text-xs text-orange-300 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5" /> Viewer role cannot import. Ask an admin or manager.
            </div>
          )}
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-navy-deep/95">
                <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  {["Sheet", "S/No", "Name", "Sub", "Desg.", "Room", "CPU", "Printer", "UPS", "Status"].map((h) =>
                    <th key={h} className="px-3 py-2">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {drafts.slice(0, 200).map((r, i) => (
                  <tr key={i} className="border-t border-border/20">
                    <td className="px-3 py-2 text-muted-foreground">{r.source_sheet}</td>
                    <td className="px-3 py-2 font-mono text-cyan-glow">{r.s_no ?? ""}</td>
                    <td className="px-3 py-2">{r.name}</td>
                    <td className="px-3 py-2 text-cyan-glow/80">{r.sub_assigned_to ?? ""}</td>
                    <td className="px-3 py-2">{r.designation}</td>
                    <td className="px-3 py-2">{r.room}</td>
                    <td className="px-3 py-2">{[r.cpu_make, r.cpu_model].filter(Boolean).join(" ")}</td>
                    <td className="px-3 py-2">{[r.printer_make, r.printer_model].filter(Boolean).join(" ")}</td>
                    <td className="px-3 py-2">{r.ups_make_model}</td>
                    <td className="px-3 py-2">{r.status_text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {drafts.length > 200 && (
              <div className="p-3 text-xs text-muted-foreground text-center">…and {drafts.length - 200} more</div>
            )}
          </div>
          {imported > 0 && (
            <div className="p-3 border-t border-border/40 text-emerald-400 text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Imported {imported} rows successfully.
            </div>
          )}
        </GlassCard>
      )}
    </PageContainer>
  );
}
