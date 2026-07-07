import { supabase } from "@/integrations/supabase/client";

export type AssetStatus = "in_use" | "in_store" | "faulty" | "retired";

export interface InventoryRow {
  id: string;
  parent_id: string | null;
  s_no: number | null;
  asset_tag: string | null;
  name: string;
  designation: string | null;
  department: string | null;
  room: string | null;
  assigned_to: string | null;
  sub_assigned_to: string | null;
  source_sheet: string | null;

  cpu_make: string | null;
  cpu_model: string | null;
  cpu_serial: string | null;

  printer_make: string | null;
  printer_model: string | null;
  printer_serial: string | null;

  scanner_make: string | null;
  scanner_model: string | null;
  scanner_serial: string | null;

  ups_make_model: string | null;
  ups_serial: string | null;

  windows_os: string | null;
  status_text: string | null;
  status: AssetStatus;

  category_id: string | null;
  category_name: string | null;
  serial_number: string | null;
  manufacturer: string | null;
  model: string | null;
  purchase_date: string | null;
  purchase_cost: number | null;
  warranty_expiry: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CategoryRow {
  id: string;
  name: string;
  description: string | null;
  low_stock_threshold: number;
}

/** Buckets the free-text STATUS field into a color group. */
export type StatusKind = "ok" | "no_backup" | "not_working" | "missing" | "exchange" | "printer_issue" | "other";

export function statusKind(text?: string | null): StatusKind {
  const t = (text ?? "").trim().toLowerCase();
  if (!t || t === "ok") return "ok";
  if (t.includes("missing")) return "missing";
  if (t.includes("not working") || t.includes("not open")) return "not_working";
  if (t.includes("exchange")) return "exchange";
  if (t.includes("no backup") || t.includes("no bakcup") || t.includes("nobackup")) return "no_backup";
  if (t.includes("adf") || t.includes("jam") || t.includes("tray") || t.includes("printer")) return "printer_issue";
  return "other";
}

export const statusKindStyle: Record<StatusKind, { label: string; cls: string }> = {
  ok:            { label: "OK",             cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" },
  no_backup:     { label: "NO BACKUP",      cls: "bg-orange-500/20 text-orange-300 border-orange-500/40" },
  not_working:   { label: "NOT WORKING",    cls: "bg-red-500/20 text-red-300 border-red-500/40" },
  missing:       { label: "MISSING",        cls: "bg-red-600/25 text-red-200 border-red-500/60" },
  exchange:      { label: "EXCHANGE",       cls: "bg-yellow-500/20 text-yellow-200 border-yellow-500/40" },
  printer_issue: { label: "PRINTER ISSUE",  cls: "bg-orange-500/20 text-orange-300 border-orange-500/40" },
  other:         { label: "OTHER",          cls: "bg-zinc-500/20 text-zinc-300 border-zinc-500/40" },
};

/** Legacy enum-status style, still used by a few pages. */
export const statusColors: Record<AssetStatus, string> = {
  in_use:   "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  in_store: "bg-sky-500/20 text-sky-300 border-sky-500/40",
  faulty:   "bg-red-500/20 text-red-300 border-red-500/40",
  retired:  "bg-zinc-500/20 text-zinc-300 border-zinc-500/40",
};
export const statusLabel: Record<AssetStatus, string> = {
  in_use: "In Use", in_store: "In Store", faulty: "Faulty", retired: "Retired",
};

export async function fetchInventory() {
  const { data, error } = await supabase
    .from("inventory")
    .select("*")
    .order("source_sheet", { ascending: true, nullsFirst: false })
    .order("s_no", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as InventoryRow[];
}
export async function fetchCategories() {
  const { data, error } = await supabase.from("categories").select("*").order("name");
  if (error) throw error;
  return (data ?? []) as CategoryRow[];
}

/** Sheet names of the source survey workbook. Used as source_sheet values and export tabs. */
export const SURVEY_SHEETS = [
  "RHQ NR (5)",
  "EXTRA LIST",
  "RHQ NR (2)",
  "pc (3)",
  "ofsulate",
  "hp z640",
  "mfp b&w",
  "mono printer",
  "A4 COLOR PRINTER",
  "A3 COLOR PRINTER CANON C3520",
  "SCANNER",
  "UPS",
] as const;
