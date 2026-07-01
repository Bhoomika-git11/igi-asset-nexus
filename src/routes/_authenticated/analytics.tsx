import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement,
  PointElement, LineElement, Title, Tooltip, Legend, Filler,
} from "chart.js";
import { fetchInventory } from "@/lib/inventory-api";
import { PageContainer, PageHeader, GlassCard } from "@/components/PageChrome";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export const Route = createFileRoute("/_authenticated/analytics")({ component: AnalyticsPage });

const chartOpts = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { labels: { color: "#c8dfff" } } },
  scales: {
    x: { ticks: { color: "#8aa8c8" }, grid: { color: "rgba(120,180,255,0.08)" } },
    y: { ticks: { color: "#8aa8c8" }, grid: { color: "rgba(120,180,255,0.08)" } },
  },
};

function AnalyticsPage() {
  const { data: inv = [] } = useQuery({ queryKey: ["inventory"], queryFn: fetchInventory });

  const byDept = groupCount(inv, (r) => r.department || "Unassigned");
  const byCat = groupCount(inv, (r) => r.category_name || "Uncategorized");
  const byStatus = groupCount(inv, (r) => r.status);

  const monthly: Record<string, number> = {};
  inv.forEach((r) => {
    const d = new Date(r.created_at);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthly[k] = (monthly[k] ?? 0) + 1;
  });
  const months = Object.keys(monthly).sort();

  return (
    <PageContainer>
      <PageHeader title="Analytics" subtitle="Visualise your asset landscape across dimensions." />

      <div className="grid lg:grid-cols-2 gap-6">
        <ChartCard title="Assets by Department" delay={0}>
          <Bar data={{
            labels: Object.keys(byDept),
            datasets: [{
              label: "Assets", data: Object.values(byDept),
              backgroundColor: "rgba(120,220,255,0.6)", borderColor: "rgba(120,220,255,1)", borderWidth: 1,
              borderRadius: 6,
            }],
          }} options={chartOpts} />
        </ChartCard>

        <ChartCard title="Status Distribution" delay={0.1}>
          <Doughnut data={{
            labels: Object.keys(byStatus),
            datasets: [{
              data: Object.values(byStatus),
              backgroundColor: ["rgba(52,211,153,0.7)", "rgba(56,189,248,0.7)", "rgba(248,113,113,0.7)", "rgba(161,161,170,0.7)"],
              borderColor: "rgba(15,20,40,1)", borderWidth: 2,
            }],
          }} options={{ ...chartOpts, scales: undefined }} />
        </ChartCard>

        <ChartCard title="Assets by Category" delay={0.2}>
          <Bar data={{
            labels: Object.keys(byCat),
            datasets: [{
              label: "Assets", data: Object.values(byCat),
              backgroundColor: "rgba(139,92,246,0.5)", borderColor: "rgba(139,92,246,1)", borderWidth: 1, borderRadius: 6,
            }],
          }} options={chartOpts} />
        </ChartCard>

        <ChartCard title="Assets Added Over Time" delay={0.3}>
          <Line data={{
            labels: months,
            datasets: [{
              label: "Added", data: months.map((m) => monthly[m]),
              borderColor: "rgba(120,220,255,1)", backgroundColor: "rgba(120,220,255,0.15)",
              fill: true, tension: 0.35, pointRadius: 4, pointBackgroundColor: "rgba(120,220,255,1)",
            }],
          }} options={chartOpts} />
        </ChartCard>
      </div>
    </PageContainer>
  );
}

function groupCount<T>(arr: T[], key: (t: T) => string): Record<string, number> {
  const o: Record<string, number> = {};
  arr.forEach((r) => { const k = key(r); o[k] = (o[k] ?? 0) + 1; });
  return o;
}

function ChartCard({ title, children, delay }: { title: string; children: React.ReactNode; delay: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      <GlassCard className="p-6">
        <h3 className="font-semibold mb-4">{title}</h3>
        <div className="h-72">{children}</div>
      </GlassCard>
    </motion.div>
  );
}
