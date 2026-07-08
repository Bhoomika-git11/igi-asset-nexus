import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Clock, ShieldCheck, Trash2, Pencil, Plus, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader, GlassCard } from "@/components/PageChrome";
import { useAuth } from "@/lib/auth";
import { na } from "@/lib/inventory-api";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/approvals")({ component: ApprovalsPage });

type RequestType = "create_asset" | "update_asset" | "delete_asset" | "create_user";
type Status = "pending" | "approved" | "rejected";

interface ApprovalRow {
  id: string;
  request_type: RequestType;
  status: Status;
  target_id: string | null;
  payload: Record<string, unknown>;
  summary: string | null;
  requested_by: string;
  requested_by_email: string | null;
  reviewed_by: string | null;
  reviewed_by_email: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
}

const typeMeta: Record<RequestType, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  create_asset: { label: "Create Asset", icon: Plus, color: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10" },
  update_asset: { label: "Update Asset", icon: Pencil, color: "text-sky-300 border-sky-500/40 bg-sky-500/10" },
  delete_asset: { label: "Delete Asset", icon: Trash2, color: "text-red-300 border-red-500/40 bg-red-500/10" },
  create_user:  { label: "New User", icon: UserPlus, color: "text-cyan-300 border-cyan-500/40 bg-cyan-500/10" },
};

const statusMeta: Record<Status, string> = {
  pending: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  approved: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  rejected: "bg-red-500/15 text-red-300 border-red-500/40",
};

function ApprovalsPage() {
  const { role, user } = useAuth();
  const isAdmin = role === "admin";
  const qc = useQueryClient();
  const [tab, setTab] = useState<Status>("pending");
  const [detail, setDetail] = useState<ApprovalRow | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["approval_requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("approval_requests" as never)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ApprovalRow[];
    },
  });

  const filtered = rows.filter((r) => r.status === tab);
  const counts = {
    pending: rows.filter((r) => r.status === "pending").length,
    approved: rows.filter((r) => r.status === "approved").length,
    rejected: rows.filter((r) => r.status === "rejected").length,
  };

  const decide = useMutation({
    mutationFn: async ({ row, decision, notes }: { row: ApprovalRow; decision: "approved" | "rejected"; notes?: string }) => {
      if (!isAdmin) throw new Error("Only admins can approve requests");

      // Apply the underlying operation FIRST when approving
      if (decision === "approved") {
        if (row.request_type === "create_asset") {
          const { id: _drop, ...insert } = (row.payload as Record<string, unknown>) ?? {};
          void _drop;
          const { error } = await supabase.from("inventory").insert(insert as never);
          if (error) throw error;
        } else if (row.request_type === "update_asset" && row.target_id) {
          const { id: _drop, ...upd } = (row.payload as Record<string, unknown>) ?? {};
          void _drop;
          const { error } = await supabase.from("inventory").update(upd as never).eq("id", row.target_id);
          if (error) throw error;
        } else if (row.request_type === "delete_asset" && row.target_id) {
          const { error } = await supabase.from("inventory").delete().eq("id", row.target_id);
          if (error) throw error;
        }
        // create_user requests are recorded — admin provisions the account manually.
      }

      const { error } = await supabase
        .from("approval_requests" as never)
        .update({
          status: decision,
          review_notes: notes ?? null,
          reviewed_by: user?.id,
          reviewed_by_email: user?.email,
          reviewed_at: new Date().toISOString(),
        } as never)
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["approval_requests"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast.success(vars.decision === "approved" ? "Request approved" : "Request rejected");
      setDetail(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <PageContainer>
      <PageHeader
        title="Approval Requests"
        subtitle={isAdmin ? "Review and act on manager requests." : "Your submitted requests and their status."}
      />

      <div className="flex gap-2 mb-4 flex-wrap">
        {(["pending", "approved", "rejected"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setTab(s)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition flex items-center gap-2 ${
              tab === s ? "bg-cyan-glow text-navy-deep" : "glass border border-border/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            {s === "pending" && <Clock className="w-4 h-4" />}
            {s === "approved" && <ShieldCheck className="w-4 h-4" />}
            {s === "rejected" && <X className="w-4 h-4" />}
            {s} <span className="text-[10px] opacity-70">({counts[s]})</span>
          </button>
        ))}
      </div>

      <GlassCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border/40">
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Summary</th>
                <th className="px-4 py-3">Requested By</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (<tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Loading…</td></tr>)}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={6} className="p-12 text-center text-muted-foreground">No {tab} requests.</td></tr>
              )}
              {filtered.map((r) => {
                const meta = typeMeta[r.request_type];
                const Icon = meta.icon;
                return (
                  <tr key={r.id} className="border-b border-border/20 hover:bg-white/[0.03]">
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 rounded border ${meta.color}`}>
                        <Icon className="w-3 h-3" /> {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-[380px]"><div className="truncate">{na(r.summary)}</div></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{na(r.requested_by_email)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded border ${statusMeta[r.status]}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => setDetail(r)}
                          className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-white/5">View</button>
                        {isAdmin && r.status === "pending" && (
                          <>
                            <button onClick={() => decide.mutate({ row: r, decision: "approved" })}
                              disabled={decide.isPending}
                              className="text-xs px-3 py-1.5 rounded-md bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 flex items-center gap-1">
                              <Check className="w-3 h-3" /> Approve
                            </button>
                            <button onClick={() => {
                              const notes = prompt("Reason for rejection (optional):") ?? "";
                              decide.mutate({ row: r, decision: "rejected", notes });
                            }}
                              disabled={decide.isPending}
                              className="text-xs px-3 py-1.5 rounded-md bg-red-500/20 text-red-300 hover:bg-red-500/30 flex items-center gap-1">
                              <X className="w-3 h-3" /> Reject
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <AnimatePresence>
        {detail && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setDetail(null)}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-strong rounded-2xl p-8 w-full max-w-2xl max-h-[80vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">Request Detail</h3>
                <button onClick={() => setDetail(null)} className="p-2 rounded-lg hover:bg-white/10">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                <Info label="Type" v={typeMeta[detail.request_type].label} />
                <Info label="Status" v={detail.status} />
                <Info label="Summary" v={na(detail.summary)} />
                <Info label="Requested By" v={na(detail.requested_by_email)} />
                <Info label="Submitted" v={new Date(detail.created_at).toLocaleString()} />
                <Info label="Reviewed By" v={na(detail.reviewed_by_email)} />
                <Info label="Review Notes" v={na(detail.review_notes)} />
              </div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Payload</div>
              <pre className="bg-black/40 rounded-lg p-4 text-[11px] overflow-auto max-h-[300px] font-mono text-cyan-glow/90">
                {JSON.stringify(detail.payload, null, 2)}
              </pre>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageContainer>
  );
}

function Info({ label, v }: { label: string; v: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="text-sm mt-0.5 break-words">{v}</div>
    </div>
  );
}
