import { supabase } from "@/integrations/supabase/client";

export type AssetStatus = "in_use" | "in_store" | "faulty" | "retired";

export interface InventoryRow {
  id: string;
  asset_tag: string | null;
  name: string;
  s_no: number | null;
  category_id: string | null;
  category_name: string | null;
  department: string | null;
  room: string | null;
  assigned_to: string | null;
  sub_assigned_to: string | null;
  parent_id: string | null;
  status: AssetStatus;
  status_text: string | null;
  serial_number: string | null;
  manufacturer: string | null;
  model: string | null;
  purchase_date: string | null;
  purchase_cost: number | null;
  warranty_expiry: string | null;
  notes: string | null;
  designation: string | null;
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
  source_sheet: string | null;
  created_at: string;
  updated_at: string;
}

export interface CategoryRow {
  id: string;
  name: string;
  description: string | null;
  low_stock_threshold: number;
}

export const statusColors: Record<AssetStatus, string> = {
  in_use: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  in_store: "bg-sky-500/20 text-sky-300 border-sky-500/40",
  faulty: "bg-red-500/20 text-red-300 border-red-500/40",
  retired: "bg-zinc-500/20 text-zinc-300 border-zinc-500/40",
};

export const statusLabel: Record<AssetStatus, string> = {
  in_use: "In Use",
  in_store: "In Store",
  faulty: "Faulty",
  retired: "Retired",
};

/** Show a friendly "Not Available" for missing values. */
export const na = <T,>(v: T | null | undefined | ""): string =>
  v === null || v === undefined || v === "" ? "Not Available" : String(v);

export async function fetchInventory() {
  const { data, error } = await supabase
    .from("inventory")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as InventoryRow[];
}

export async function fetchCategories() {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("name");
  if (error) throw error;
  return (data ?? []) as CategoryRow[];
}
