// Single source of truth for asset category options across the app.
// Order matters — it is the order shown in dropdowns and filters.
export const ASSET_CATEGORIES = [
  "Desktop",
  "Laptop",
  "All In One",
  "Desktop All In One",
  "Mono Printer",
  "MF Machine",
  "Scanner",
  "UPS",
  "Biometric Machine",
] as const;

export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

export const DEPARTMENTS = [
  "RHQ NR", "LAW", "UNION OFFICE", "TECH/SC", "SC SECTION", "VIG",
  "CNS", "AUDIT ROOM", "FIN", "CIVIL", "FIRE CONTROL ROOM", "STORE", "MT",
] as const;

export const WINDOWS_OS_OPTIONS = ["Windows 7", "Windows 8", "Windows 10", "Windows 11"] as const;
export const CPU_MAKES = ["HP", "DELL", "ACER", "LENOVO", "HCL"] as const;

export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

export const DEPARTMENTS = [
  "RHQ NR", "LAW", "UNION OFFICE", "TECH/SC", "SC SECTION", "VIG",
  "CNS", "AUDIT ROOM", "FIN", "CIVIL", "FIRE CONTROL ROOM", "STORE", "MT",
] as const;

export const WINDOWS_OS_OPTIONS = ["Windows 7", "Windows 8", "Windows 10", "Windows 11"] as const;
export const CPU_MAKES = ["HP", "DELL", "ACER", "LENOVO", "HCL"] as const;
