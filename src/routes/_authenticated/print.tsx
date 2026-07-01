import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Printer, Plane } from "lucide-react";
import { fetchInventory, statusLabel } from "@/lib/inventory-api";
import { PageContainer, PageHeader, GlassCard } from "@/components/PageChrome";

export const Route = createFileRoute("/_authenticated/print")({ component: PrintPage });

function PrintPage() {
  const { data: inv = [] } = useQuery({ queryKey: ["inventory"], queryFn: fetchInventory });

  return (
    <PageContainer>
      <PageHeader title="Print Report" subtitle="Formatted report with official AAI header."
        actions={<button onClick={() => window.print()} className="rounded-lg bg-gradient-to-r from-electric to-cyan-glow text-navy-deep font-semibold px-4 py-2 text-sm flex items-center gap-2"><Printer className="w-4 h-4" /> Print</button>}
      />

      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 15mm; }
          body, html { background: white !important; color: black !important; }
          .no-print { display: none !important; }
          .print-sheet { background: white !important; color: black !important; box-shadow: none !important; border: none !important; }
          .print-sheet * { color: black !important; }
          .print-sheet table th { background: #0f2540 !important; color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <GlassCard className="p-10 print-sheet bg-white text-black">
        <div className="border-b-4 border-double border-navy-deep pb-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-navy-deep flex items-center justify-center">
              <Plane className="w-8 h-8 text-cyan-glow" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-navy-deep font-semibold">भारतीय विमानपत्तन प्राधिकरण</div>
              <div className="text-xl font-bold text-navy-deep">Airports Authority of India</div>
              <div className="text-sm text-navy-deep/80">Indira Gandhi International Airport · IT Asset Report</div>
            </div>
          </div>
          <div className="text-right text-xs text-navy-deep/70">
            <div>Ref: IGI/IT/AST/{new Date().getFullYear()}</div>
            <div>Generated: {new Date().toLocaleString()}</div>
            <div>Total assets: {inv.length}</div>
          </div>
        </div>

        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-navy-deep text-white">
              <th className="border p-2 text-left">Tag</th>
              <th className="border p-2 text-left">Name</th>
              <th className="border p-2 text-left">Category</th>
              <th className="border p-2 text-left">Department</th>
              <th className="border p-2 text-left">Room</th>
              <th className="border p-2 text-left">Assigned</th>
              <th className="border p-2 text-left">Status</th>
              <th className="border p-2 text-left">Serial</th>
            </tr>
          </thead>
          <tbody>
            {inv.map((r) => (
              <tr key={r.id} className="odd:bg-slate-50">
                <td className="border p-2 font-mono">{r.asset_tag}</td>
                <td className="border p-2">{r.name}</td>
                <td className="border p-2">{r.category_name ?? "-"}</td>
                <td className="border p-2">{r.department ?? "-"}</td>
                <td className="border p-2">{r.room ?? "-"}</td>
                <td className="border p-2">{r.assigned_to ?? "-"}</td>
                <td className="border p-2">{statusLabel[r.status]}</td>
                <td className="border p-2">{r.serial_number ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-8 pt-4 border-t border-navy-deep/30 grid grid-cols-3 gap-8 text-xs text-navy-deep/80">
          <div><div className="mt-8 border-t border-navy-deep/60 pt-1">Prepared by</div></div>
          <div><div className="mt-8 border-t border-navy-deep/60 pt-1">Verified by</div></div>
          <div><div className="mt-8 border-t border-navy-deep/60 pt-1">Approved by (IT Head, IGI)</div></div>
        </div>
      </GlassCard>
    </PageContainer>
  );
}
