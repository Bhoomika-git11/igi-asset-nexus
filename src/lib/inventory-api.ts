import { supabase } from "@/integrations/supabase/client";

export type AssetStatus = "in_use" | "in_store" | "faulty" | "retired";
export interface InventoryRow {
  id: string; asset_tag: string; name: string;
  category_id: string | null; category_name: string | null;
  department: string | null; room: string | null; assigned_to: string | null;
  status: AssetStatus;
  serial_number: string | null; manufacturer: string | null; model: string | null;
  purchase_date: string | null; purchase_cost: number | null; warranty_expiry: string | null;
  notes: string | null; created_at: string; updated_at: string;
}
export interface CategoryRow {
  id: string; name: string; description: string | null; low_stock_threshold: number;
}

export const statusColors: Record<AssetStatus, string> = {
  in_use: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  in_store: "bg-sky-500/20 text-sky-300 border-sky-500/40",
  faulty: "bg-red-500/20 text-red-300 border-red-500/40",
  retired: "bg-zinc-500/20 text-zinc-300 border-zinc-500/40",
};
export const statusLabel: Record<AssetStatus, string> = {
  in_use: "In Use", in_store: "In Store", faulty: "Faulty", retired: "Retired",
};

export async function fetchInventory() {
  const { data, error } = await supabase.from("inventory").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as InventoryRow[];
}
export async function fetchCategories() {
  const { data, error } = await supabase.from("categories").select("*").order("name");
  if (error) throw error;
  return (data ?? []) as CategoryRow[];
}
