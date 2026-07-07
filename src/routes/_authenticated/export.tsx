import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, FileText } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { fetchInventory, type InventoryRow } from "@/lib/inventory-api";
import { PageContainer, PageHeader, GlassCard } from "@/components/PageChrome";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/export")({ component: ExportPage });

const HEADERS = [
  "S/No", "Name", "Degn.", "Room No",
  "CPU MAKE", "CPU MODEL", "CPU SERIAL NO",
  "PRINTER MAKE", "PRINTER MODEL", "PRINTER SERIAL NO",
  "SCANNER MAKE", "SCANNER MODEL", "SCANNER SERIAL NO",
  "UPS MAKE/MODEL", "UPS SERIAL NO",
  "WINDOW", "STATUS",
];

function toSheetRow(r: InventoryRow) {
  const nameOut = r.sub_assigned_to ? `${r.name} (${r.sub_assigned_to})` : r.name;
  return [
    r.s_no ?? "", nameOut, r.designation ?? "", r.room ?? "",
    r.cpu_make ?? "", r.cpu_model ?? "", r.cpu_serial ?? "",
    r.printer_make ?? "", r.printer_model ?? "", r.printer_serial ?? "",
    r.scanner_make ?? "", r.scanner_model ?? "", r.scanner_serial ?? "",
    r.ups_make_model ?? "", r.ups_serial ?? "",
    r.windows_os ?? "", r.status_text ?? "",
  ];
}

function ExportPage() {
  const { data: inv = [] } = useQuery({ queryKey: ["inventory"], queryFn: fetchInventory });
  const [dept, setDept] = useState("all");

  const depts = useMemo(() => Array.from(new Set(inv.map((r) => r.department ?? "").filter(Boolean))).sort(), [inv]);
  const scoped = useMemo(
    () => dept === "all" ? inv : inv.filter((r) => (r.department ?? "") === dept),
    [inv, dept],
  );

  const sheetsMap = useMemo(() => {
    const m = new Map<string, InventoryRow[]>();
    for (const r of scoped) {
      const k = (r.source_sheet ?? "Inventory").trim() || "Inventory";
      const list = m.get(k) ?? [];
      list.push(r);
      m.set(k, list);
    }
    return m;
  }, [scoped]);

  const toExcel = () => {
    const wb = XLSX.utils.book_new();
    for (const [sheet, rows] of sheetsMap.entries()) {
      const aoa: (string | number)[][] = [HEADERS, ...rows.map(toSheetRow)];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws["!cols"] = HEADERS.map(() => ({ wch: 18 }));
      const safe = sheet.replace(/[\\/?*[\]]/g, " ").slice(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, safe);
    }
    if (sheetsMap.size === 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([HEADERS]), "Inventory");
    }
    XLSX.writeFile(wb, `aai-inventory-${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success("Excel exported");
  };

  const toPDF = () => {
    const doc = new jsPDF({ orientation: "landscape", format: "a3" });
    doc.setFillColor(15, 20, 40); doc.rect(0, 0, 500, 24, "F");
    doc.setTextColor(120, 220, 255); doc.setFontSize(14).setFont("helvetica", "bold");
    doc.text("Airports Authority of India — IGI Airport IT Asset Portal", 14, 15);
    doc.setFontSize(9); doc.setTextColor(200, 220, 255);
    doc.text(`Generated ${new Date().toLocaleString()} · ${scoped.length} assets`, 14, 21);

    autoTable(doc, {
      startY: 30,
      head: [HEADERS],
      body: scoped.map(toSheetRow),
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [30, 60, 120], textColor: [200, 240, 255] },
      alternateRowStyles: { fillColor: [245, 249, 255] },
    });
    doc.save(`aai-inventory-${new Date().toISOString().split("T")[0]}.pdf`);
    toast.success("PDF exported");
  };

  return (
    <PageContainer>
      <PageHeader
        title="Export Data"
        subtitle={`${scoped.length} of ${inv.length} assets · ${sheetsMap.size} sheets`}
        actions={
          <select value={dept} onChange={(e) => setDept(e.target.value)}
            className="rounded-lg bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:border-cyan-glow">
            <option value="all">All departments</option>
            {depts.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        }
      />
      <div className="grid md:grid-cols-2 gap-6 max-w-3xl">
        <ExportCard
          title="Excel (.xlsx)"
          desc="Preserves the original sheet structure — one tab per category, exact column headers."
          icon={FileSpreadsheet} onClick={toExcel} color="from-emerald-500 to-teal-400"
        />
        <ExportCard
          title="PDF Report"
          desc="Formatted landscape report with the AAI header, suitable for sharing and archival."
          icon={FileText} onClick={toPDF} color="from-red-500 to-orange-400"
        />
      </div>
    </PageContainer>
  );
}

function ExportCard({ title, desc, icon: Icon, onClick, color }: {
  title: string; desc: string; icon: React.ComponentType<{ className?: string }>; onClick: () => void; color: string;
}) {
  return (
    <GlassCard className="p-6 relative overflow-hidden">
      <div className={`absolute -top-10 -right-10 w-40 h-40 rounded-full bg-gradient-to-br ${color} opacity-20 blur-3xl`} />
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-4 shadow-lg`}>
        <Icon className="w-6 h-6 text-navy-deep" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1 mb-5">{desc}</p>
      <button onClick={onClick} className="rounded-lg bg-gradient-to-r from-electric to-cyan-glow text-navy-deep font-semibold px-5 py-2 text-sm">Download</button>
    </GlassCard>
  );
}
