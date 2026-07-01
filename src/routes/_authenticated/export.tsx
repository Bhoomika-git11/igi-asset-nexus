import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, FileText } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { fetchInventory, statusLabel } from "@/lib/inventory-api";
import { PageContainer, PageHeader, GlassCard } from "@/components/PageChrome";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/export")({ component: ExportPage });

function ExportPage() {
  const { data: inv = [] } = useQuery({ queryKey: ["inventory"], queryFn: fetchInventory });

  const toExcel = () => {
    const rows = inv.map((r) => ({
      asset_tag: r.asset_tag, name: r.name, category: r.category_name, department: r.department,
      room: r.room, assigned_to: r.assigned_to, status: statusLabel[r.status],
      serial_number: r.serial_number, manufacturer: r.manufacturer, model: r.model,
      purchase_date: r.purchase_date, purchase_cost: r.purchase_cost, warranty_expiry: r.warranty_expiry, notes: r.notes,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    XLSX.writeFile(wb, `igi-inventory-${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success("Excel exported");
  };

  const toPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFillColor(15, 20, 40); doc.rect(0, 0, 300, 24, "F");
    doc.setTextColor(120, 220, 255); doc.setFontSize(14).setFont("helvetica", "bold");
    doc.text("Airports Authority of India — IGI Airport IT Asset Portal", 14, 15);
    doc.setFontSize(9); doc.setTextColor(200, 220, 255); doc.text(`Generated ${new Date().toLocaleString()}`, 14, 21);

    autoTable(doc, {
      startY: 30,
      head: [["Tag", "Name", "Category", "Dept.", "Room", "Assigned", "Status"]],
      body: inv.map((r) => [r.asset_tag, r.name, r.category_name ?? "-", r.department ?? "-", r.room ?? "-", r.assigned_to ?? "-", statusLabel[r.status]]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 60, 120], textColor: [200, 240, 255] },
      alternateRowStyles: { fillColor: [245, 249, 255] },
    });
    doc.save(`igi-inventory-${new Date().toISOString().split("T")[0]}.pdf`);
    toast.success("PDF exported");
  };

  return (
    <PageContainer>
      <PageHeader title="Export Data" subtitle={`${inv.length} assets ready to export.`} />
      <div className="grid md:grid-cols-2 gap-6 max-w-3xl">
        <ExportCard title="Excel (.xlsx)" desc="Full spreadsheet with every field. Use this for bulk edits and re-import." icon={FileSpreadsheet} onClick={toExcel} color="from-emerald-500 to-teal-400" />
        <ExportCard title="PDF Report" desc="Formatted report with AAI header, suitable for sharing and archival." icon={FileText} onClick={toPDF} color="from-red-500 to-orange-400" />
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
