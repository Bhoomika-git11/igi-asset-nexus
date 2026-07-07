import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader, GlassCard } from "@/components/PageChrome";
import { canEdit, useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import type { AssetStatus } from "@/lib/inventory-api";

export const Route = createFileRoute("/_authenticated/import")({ component: ImportPage });

// ─── Types ────────────────────────────────────────────────────────────────────
interface ParsedRow {
  asset_tag: string;
  name: string;
  assigned_to: string;
  designation: string;
  room: string;
  department: string;
  cpu_make: string;
  cpu_model: string;
  cpu_serial: string;
  printer_make: string;
  printer_model: string;
  printer_serial: string;
  scanner_make: string;
  scanner_model: string;
  scanner_serial: string;
  ups_make: string;
  ups_serial: string;
  windows_os: string;
  remarks: string;
  source_sheet: string;
  status: AssetStatus;
  category_name: string;
}

interface SheetSummary {
  name: string;
  count: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Safely get a cell value as string, trim whitespace
function cell(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const val = row[key];
    if (val !== undefined && val !== null && String(val).trim() !== "") {
      return String(val).trim();
    }
  }
  return "";
}

// Map STATUS/remarks text → our 4-value status enum
function mapStatus(remarks: string): AssetStatus {
  const r = remarks.toUpperCase();
  if (r.includes("NOT WORKING") || r.includes("MISSING") || r.includes("FAULTY")) return "faulty";
  if (r.includes("STORE") || r.includes("RETIRED")) return "in_store";
  return "in_use";
}

// Determine asset category name from what data is present
function inferCategory(row: ParsedRow): string {
  if (row.cpu_serial) return "Desktop/CPU";
  if (row.printer_serial) return "Printer";
  if (row.scanner_serial) return "Scanner";
  if (row.ups_serial) return "UPS";
  return "Other";
}

// Global tag counter so every row across all sheets gets a unique tag
let globalCounter = 1;
function makeTag(row: ParsedRow): string {
  const prefix = row.cpu_serial
    ? "CPU"
    : row.printer_serial
    ? "PRT"
    : row.scanner_serial
    ? "SCN"
    : row.ups_serial
    ? "UPS"
    : "AST";
  const tag = `IGI-${prefix}-${String(globalCounter).padStart(4, "0")}`;
  globalCounter++;
  return tag;
}

// Detect which sheet type we're dealing with based on its name
function sheetType(name: string): "full" | "cpu" | "printer" | "scanner" | "ups" | "skip" {
  const n = name.toLowerCase().trim();
  if (n === "sheet2" || n === "extra list") return "skip";
  if (n.includes("rhq nr") || n === "sheet1") return "full";
  if (n.includes("pc") || n.includes("ofsulate") || n.includes("hp z640")) return "cpu";
  if (
    n.includes("mfp") ||
    n.includes("mono printer") ||
    n.includes("a4 color") ||
    n.includes("a3 color")
  )
    return "printer";
  if (n.includes("scanner")) return "scanner";
  if (n.includes("ups")) return "ups";
  return "full"; // default fallback
}

// Parse a single sheet into ParsedRow[]
function parseSheet(
  sheetName: string,
  rawRows: Record<string, unknown>[]
): ParsedRow[] {
  const type = sheetType(sheetName);
  if (type === "skip") return [];

  const results: ParsedRow[] = [];

  for (const raw of rawRows) {
    // Skip completely empty rows
    const allVals = Object.values(raw).filter((v) => v !== null && v !== undefined && String(v).trim() !== "");
    if (allVals.length === 0) continue;

    // Skip header-like rows (where first non-empty value is "S/No" or "Name")
    const firstVals = Object.values(raw).slice(0, 3).map((v) => String(v ?? "").trim().toUpperCase());
    if (firstVals.includes("S/NO") || firstVals.includes("NAME") || firstVals.includes("DEGN.")) continue;

    let row: ParsedRow = {
      asset_tag: "",
      name: "",
      assigned_to: "",
      designation: "",
      room: "",
      department: "",
      cpu_make: "",
      cpu_model: "",
      cpu_serial: "",
      printer_make: "",
      printer_model: "",
      printer_serial: "",
      scanner_make: "",
      scanner_model: "",
      scanner_serial: "",
      ups_make: "",
      ups_serial: "",
      windows_os: "",
      remarks: "",
      source_sheet: sheetName,
      status: "in_use",
      category_name: "",
    };

    // Common fields across all sheet types
    row.assigned_to = cell(raw, "Name", "NAME");
    row.designation = cell(raw, "Degn.", "DEGN.", "Designation");
    row.room = cell(raw, "Room No", "ROOM NO", "Room");

    if (type === "full") {
      row.cpu_make    = cell(raw, "CPU MAKE", "CPU Make");
      row.cpu_model   = cell(raw, "CPU MODEL", "CPU Model");
      row.cpu_serial  = cell(raw, "CPU SERIAL NO", "CPU Serial No");
      row.printer_make   = cell(raw, "PRINTER MAKE ", "PRINTER MAKE", "Printer Make");
      row.printer_model  = cell(raw, "PRINTER MODEL ", "PRINTER MODEL", "Printer Model");
      row.printer_serial = cell(raw, "PRINTER SERIAL NO", "Printer Serial No");
      row.scanner_make   = cell(raw, "SCANNER MAKE", "Scanner Make");
      row.scanner_model  = cell(raw, "SCANNER MODEL ", "SCANNER MODEL", "Scanner Model");
      row.scanner_serial = cell(raw, "SCANNER SERIAL NO ", "SCANNER SERIAL NO", "Scanner Serial No");
      row.ups_make   = cell(raw, "UPS MAKE/MODEL", "UPS Make/Model");
      row.ups_serial = cell(raw, "UPS SERIAL NO ", "UPS SERIAL NO", "UPS Serial No");
      row.windows_os = cell(raw, "WINDOW  ", "WINDOW", "Windows");
      row.remarks    = cell(raw, "STATUS", "Status", "Remarks");
    } else if (type === "cpu") {
      row.cpu_make   = cell(raw, "CPU MAKE", "CPU Make");
      row.cpu_model  = cell(raw, "CPU MODEL", "CPU Model");
      row.cpu_serial = cell(raw, "CPU SERIAL NO", "CPU Serial No");
      row.remarks    = cell(raw, "STATUS", "Status", "Remarks");
    } else if (type === "printer") {
      row.printer_make   = cell(raw, "PRINTER MAKE", "PRINTER MAKE ", "Printer Make");
      row.printer_model  = cell(raw, "PRINTER MODEL", "PRINTER MODEL ", "Printer Model");
      row.printer_serial = cell(raw, "PRINTER SERIAL NO", "Printer Serial No");
      row.remarks        = cell(raw, "STATUS", "Status", "Remarks");
    } else if (type === "scanner") {
      row.scanner_make   = cell(raw, "SCANNER MAKE", "Scanner Make");
      row.scanner_model  = cell(raw, "SCANNER MODEL", "Scanner Model");
      row.scanner_serial = cell(raw, "SCANNER SERIAL NO", "Scanner Serial No");
    } else if (type === "ups") {
      row.ups_make   = cell(raw, "UPS MAKE/MODEL", "UPS Make/Model");
      row.ups_serial = cell(raw, "UPS SERIAL NO", "UPS Serial No");
    }

    // Skip rows with no meaningful data at all
    if (
      !row.assigned_to &&
      !row.cpu_serial &&
      !row.printer_serial &&
      !row.scanner_serial &&
      !row.ups_serial
    ) continue;

    row.status = mapStatus(row.remarks);
    row.category_name = inferCategory(row);
    row.asset_tag = makeTag(row);
    // Use assigned_to as the "name" field the DB requires
    row.name = row.assigned_to || row.cpu_serial || row.printer_serial || "Unknown";

    results.push(row);
  }

  return results;
}

// ─── Component ────────────────────────────────────────────────────────────────
function ImportPage() {
  const { role } = useAuth();
  const qc = useQueryClient();
  const [allRows, setAllRows] = useState<ParsedRow[]>([]);
  const [sheetSummary, setSheetSummary] = useState<SheetSummary[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState("");
  const [imported, setImported] = useState(0);
  const [activeTab, setActiveTab] = useState<"all" | "cpu" | "printer" | "scanner" | "ups">("all");

  // ── Parse all sheets ────────────────────────────────────────────────────────
  const parseFile = async (f: File) => {
    globalCounter = 1; // reset counter for fresh import
    const buf = await f.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });

    const summaries: SheetSummary[] = [];
    let combinedRows: ParsedRow[] = [];

    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
        defval: "",
        raw: false, // treat all values as strings
      });
      const parsed = parseSheet(sheetName, rawRows);
      if (parsed.length > 0) {
        summaries.push({ name: sheetName, count: parsed.length });
        combinedRows = [...combinedRows, ...parsed];
      }
    }

    setAllRows(combinedRows);
    setSheetSummary(summaries);
    setFileName(f.name);
    setImported(0);
    setProgress(0);
    toast.success(`Parsed ${combinedRows.length} rows across ${summaries.length} sheets`);
  };

  // ── Drag & drop ─────────────────────────────────────────────────────────────
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) parseFile(f);
  };

  // ── Import to Supabase in batches of 50 ────────────────────────────────────
  const doImport = async () => {
    if (!canEdit(role)) { toast.error("Insufficient permission"); return; }
    setLoading(true);
    setProgress(0);
    try {
      const BATCH = 50;
      const total = allRows.length;
      const batches = Math.ceil(total / BATCH);
      let done = 0;

      for (let i = 0; i < batches; i++) {
        const slice = allRows.slice(i * BATCH, (i + 1) * BATCH);
        setProgressMsg(`Importing batch ${i + 1} of ${batches}…`);

        const payload = slice.map((r) => ({
          asset_tag:      r.asset_tag,
          name:           r.name,
          assigned_to:    r.assigned_to || null,
          department:     r.department || null,
          room:           r.room || null,
          status:         r.status,
          category_name:  r.category_name || null,
          // original fields reused
          manufacturer:   r.cpu_make || r.printer_make || null,
          model:          r.cpu_model || r.printer_model || null,
          serial_number:  r.cpu_serial || r.printer_serial || r.scanner_serial || r.ups_serial || null,
          notes:          r.remarks || null,
          // new AAI fields stored in notes as JSON string for now
          // (until migration adds the columns — see SQL below)
          // We store everything in notes as a fallback
          // Once SQL migration runs, swap these to direct columns:
          /*
          designation:    r.designation || null,
          cpu_make:       r.cpu_make || null,
          cpu_model:      r.cpu_model || null,
          cpu_serial:     r.cpu_serial || null,
          printer_make:   r.printer_make || null,
          printer_model:  r.printer_model || null,
          printer_serial: r.printer_serial || null,
          scanner_make:   r.scanner_make || null,
          scanner_model:  r.scanner_model || null,
          scanner_serial: r.scanner_serial || null,
          ups_make:       r.ups_make || null,
          ups_serial:     r.ups_serial || null,
          windows_os:     r.windows_os || null,
          remarks:        r.remarks || null,
          source_sheet:   r.source_sheet || null,
          */
          // Temporary: pack extra fields into notes as readable text
          // Remove this once SQL migration is applied
          notes: [
            r.remarks ? `Remarks: ${r.remarks}` : "",
            r.designation ? `Designation: ${r.designation}` : "",
            r.cpu_make ? `CPU: ${r.cpu_make} ${r.cpu_model} (S/N: ${r.cpu_serial})` : "",
            r.printer_make ? `Printer: ${r.printer_make} ${r.printer_model} (S/N: ${r.printer_serial})` : "",
            r.scanner_make ? `Scanner: ${r.scanner_make} ${r.scanner_model} (S/N: ${r.scanner_serial})` : "",
            r.ups_make ? `UPS: ${r.ups_make} (S/N: ${r.ups_serial})` : "",
            r.windows_os ? `OS: ${r.windows_os}` : "",
            `Sheet: ${r.source_sheet}`,
          ].filter(Boolean).join(" | "),
        }));

        const { error } = await supabase
          .from("inventory")
          .upsert(payload as never, { onConflict: "asset_tag" });
        if (error) throw error;

        done += slice.length;
        setProgress(Math.round((done / total) * 100));
      }

      setImported(done);
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast.success(`✓ Import complete: ${done} assets added across ${sheetSummary.length} sheets`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Import failed";
      toast.error(msg);
    } finally {
      setLoading(false);
      setProgressMsg("");
    }
  };

  // ── Filtered preview rows ───────────────────────────────────────────────────
  const previewRows = allRows.filter((r) => {
    if (activeTab === "cpu")     return !!r.cpu_serial;
    if (activeTab === "printer") return !!r.printer_serial;
    if (activeTab === "scanner") return !!r.scanner_serial;
    if (activeTab === "ups")     return !!r.ups_serial;
    return true;
  });

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <PageContainer>
      <PageHeader
        title="Excel Import"
        subtitle="Upload your AAI survey Excel file — all sheets are read automatically."
      />

      {/* Drop zone */}
      <div
        className={`glass rounded-2xl p-12 mb-6 border-2 border-dashed transition ${
          drag ? "border-cyan-glow bg-cyan-glow/5" : "border-border/60"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
      >
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-electric to-cyan-glow flex items-center justify-center mb-4 animate-pulse-glow">
            <Upload className="w-8 h-8 text-navy-deep" />
          </div>
          <h3 className="text-lg font-semibold">Drop your Excel file here</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Reads ALL sheets automatically (.xlsx)
          </p>
          <input
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            id="fileup"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) parseFile(f); }}
          />
          <label
            htmlFor="fileup"
            className="mt-4 cursor-pointer rounded-lg bg-primary/80 hover:bg-primary text-primary-foreground px-5 py-2 text-sm font-medium"
          >
            Choose file
          </label>
          {fileName && (
            <div className="mt-4 text-xs text-cyan-glow flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4" />
              {fileName} · {allRows.length} total rows
            </div>
          )}
        </div>
      </div>

      {/* Sheet summary cards */}
      {sheetSummary.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
          {sheetSummary.map((s) => (
            <GlassCard key={s.name} className="p-3 text-center">
              <div className="text-xs text-muted-foreground truncate">{s.name}</div>
              <div className="text-2xl font-bold text-cyan-glow">{s.count}</div>
              <div className="text-[10px] text-muted-foreground">rows</div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Preview table */}
      {allRows.length > 0 && (
        <GlassCard className="overflow-hidden">
          {/* Header + Import button */}
          <div className="p-4 flex flex-wrap items-center justify-between gap-3 border-b border-border/40">
            <div className="text-sm">
              Preview:{" "}
              <span className="text-cyan-glow font-semibold">{allRows.length}</span> rows
              across{" "}
              <span className="text-cyan-glow font-semibold">{sheetSummary.length}</span>{" "}
              sheets
            </div>
            <button
              onClick={doImport}
              disabled={loading || !canEdit(role)}
              className="rounded-lg bg-gradient-to-r from-electric to-cyan-glow text-navy-deep font-semibold px-5 py-2 text-sm flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              {loading ? progressMsg || "Importing…" : `Import ${allRows.length} rows`}
            </button>
          </div>

          {/* Progress bar */}
          {loading && (
            <div className="px-4 py-2 border-b border-border/40">
              <div className="w-full bg-white/10 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-electric to-cyan-glow h-2 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="text-xs text-muted-foreground mt-1">{progress}% complete</div>
            </div>
          )}

          {/* Asset type tabs */}
          <div className="flex gap-1 p-3 border-b border-border/40 overflow-x-auto">
            {(["all", "cpu", "printer", "scanner", "ups"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                  activeTab === tab
                    ? "bg-cyan-glow text-navy-deep"
                    : "bg-white/5 text-muted-foreground hover:bg-white/10"
                }`}
              >
                {tab === "all"
                  ? `All (${allRows.length})`
                  : tab === "cpu"
                  ? `CPU (${allRows.filter((r) => r.cpu_serial).length})`
                  : tab === "printer"
                  ? `Printer (${allRows.filter((r) => r.printer_serial).length})`
                  : tab === "scanner"
                  ? `Scanner (${allRows.filter((r) => r.scanner_serial).length})`
                  : `UPS (${allRows.filter((r) => r.ups_serial).length})`}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-navy-deep/95 z-10">
                <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2">Auto Tag</th>
                  <th className="px-3 py-2">Assigned To</th>
                  <th className="px-3 py-2">Designation</th>
                  <th className="px-3 py-2">Room</th>
                  <th className="px-3 py-2">CPU</th>
                  <th className="px-3 py-2">Printer</th>
                  <th className="px-3 py-2">Scanner</th>
                  <th className="px-3 py-2">UPS</th>
                  <th className="px-3 py-2">OS</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Sheet</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.slice(0, 200).map((r, i) => (
                  <tr
                    key={i}
                    className="border-t border-border/20 hover:bg-white/[0.03] transition"
                  >
                    <td className="px-3 py-2 font-mono text-cyan-glow whitespace-nowrap">
                      {r.asset_tag}
                    </td>
                    <td className="px-3 py-2 font-medium max-w-[120px] truncate">
                      {r.assigned_to || "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {r.designation || "—"}
                    </td>
                    <td className="px-3 py-2">{r.room || "—"}</td>
                    <td className="px-3 py-2 max-w-[130px]">
                      {r.cpu_make ? (
                        <>
                          <div className="font-medium truncate">
                            {r.cpu_make} {r.cpu_model}
                          </div>
                          <div className="text-[9px] text-muted-foreground font-mono truncate">
                            {r.cpu_serial}
                          </div>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 max-w-[130px]">
                      {r.printer_make ? (
                        <>
                          <div className="font-medium truncate">
                            {r.printer_make} {r.printer_model}
                          </div>
                          <div className="text-[9px] text-muted-foreground font-mono truncate">
                            {r.printer_serial}
                          </div>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 max-w-[100px]">
                      {r.scanner_make ? (
                        <div className="truncate">
                          {r.scanner_make} {r.scanner_model}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 max-w-[100px]">
                      {r.ups_make ? (
                        <div className="truncate">{r.ups_make}</div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 max-w-[80px] truncate text-muted-foreground">
                      {r.windows_os || "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`text-[9px] uppercase tracking-wider px-2 py-0.5 rounded border ${
                          r.status === "in_use"
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                            : r.status === "faulty"
                            ? "bg-red-500/20 text-red-300 border-red-500/40"
                            : "bg-sky-500/20 text-sky-300 border-sky-500/40"
                        }`}
                      >
                        {r.status === "in_use"
                          ? "In Use"
                          : r.status === "faulty"
                          ? "Faulty"
                          : "In Store"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[9px] text-muted-foreground max-w-[100px] truncate">
                      {r.source_sheet}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {previewRows.length > 200 && (
              <div className="p-3 text-xs text-muted-foreground text-center">
                Showing first 200 of {previewRows.length} rows in this tab
              </div>
            )}
          </div>

          {/* Success message */}
          {imported > 0 && (
            <div className="p-3 border-t border-border/40 text-emerald-400 text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              ✓ Import complete: {imported} assets added across {sheetSummary.length} sheets
            </div>
          )}

          {/* Warning about notes packing */}
          <div className="p-3 border-t border-border/40 text-amber-400 text-xs flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              CPU, Printer, Scanner, UPS details are stored in the Notes field until the
              database migration is applied. Run the SQL migration in Supabase to unlock
              dedicated columns for each asset type.
            </span>
          </div>
        </GlassCard>
      )}
    </PageContainer>
  );
}
