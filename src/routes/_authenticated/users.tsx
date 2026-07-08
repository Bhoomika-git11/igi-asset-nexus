import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader, GlassCard } from "@/components/PageChrome";
import { useAuth, type Role } from "@/lib/auth";
import { na } from "@/lib/inventory-api";
import { toast } from "sonner";
import { Shield, ShieldAlert, User as UserIcon, UserPlus, X, Send } from "lucide-react";


export const Route = createFileRoute("/_authenticated/users")({ component: UsersPage });

interface ProfileRow { id: string; email: string; full_name: string | null; department: string | null; }
interface UserRoleRow { user_id: string; role: Role; }

function UsersPage() {
  const { user: me, role: myRole } = useAuth();
  const qc = useQueryClient();

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProfileRow[];
    },
  });
  const { data: roles = [] } = useQuery({
    queryKey: ["user_roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id,role");
      if (error) throw error;
      return (data ?? []) as UserRoleRow[];
    },
  });
  const roleMap = new Map<string, Role>();
  roles.forEach((r) => { if (!roleMap.has(r.user_id)) roleMap.set(r.user_id, r.role); });

  const setRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: Role }) => {
      await supabase.from("user_roles").delete().eq("user_id", userId);
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["user_roles"] }); toast.success("Role updated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const delUser = useMutation({
    mutationFn: async (id: string) => {
      // Only profile row (client cannot delete auth.users without service key). Deletes cascade user_roles.
      const { error } = await supabase.from("profiles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["profiles"] }); toast.success("User removed from portal"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const isAdmin = myRole === "admin";
  const isManager = myRole === "manager";
  const [requestOpen, setRequestOpen] = useState(false);

  const requestUser = useMutation({
    mutationFn: async (payload: { email: string; full_name: string; department: string; role: Role }) => {
      const req = {
        request_type: "create_user",
        target_id: null,
        payload: payload as never,
        summary: `New ${payload.role} account for ${payload.email}`,
        requested_by: me?.id,
        requested_by_email: me?.email,
      };
      const { error } = await supabase.from("approval_requests" as never).insert(req as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["approval_requests"] });
      toast.success("New user request sent to admin");
      setRequestOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <PageContainer>
      <PageHeader
        title="User Management"
        subtitle={isAdmin ? "Admins provision accounts and set roles." : isManager ? "Submit new user requests for admin approval." : "Read-only view."}
        actions={isManager && (
          <button onClick={() => setRequestOpen(true)}
            className="rounded-lg bg-gradient-to-r from-electric to-cyan-glow text-navy-deep font-semibold px-4 py-2 text-sm flex items-center gap-2">
            <UserPlus className="w-4 h-4" /> Request New User
          </button>
        )}
      />
      <GlassCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border/40">
                <th className="px-4 py-3">User</th><th className="px-4 py-3">Department</th><th className="px-4 py-3">Role</th><th className="px-4 py-3"> </th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => {
                const r = roleMap.get(p.id) ?? "viewer";
                const isMe = p.id === me?.id;
                return (
                  <tr key={p.id} className="border-b border-border/20 hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-electric to-cyan-glow flex items-center justify-center text-xs font-bold text-navy-deep">
                          {p.email[0]?.toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium">{p.full_name || p.email.split("@")[0]} {isMe && <span className="text-cyan-glow text-xs">(you)</span>}</div>
                          <div className="text-xs text-muted-foreground">{p.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">{na(p.department)}</td>
                    <td className="px-4 py-3">
                      {isAdmin && !isMe ? (
                        <select value={r} onChange={(e) => setRole.mutate({ userId: p.id, role: e.target.value as Role })}
                          className="rounded-md bg-input border border-border px-2 py-1 text-xs focus:outline-none focus:border-cyan-glow">
                          <option value="admin">Admin</option>
                          <option value="manager">Manager</option>
                          <option value="viewer">User</option>
                        </select>
                      ) : (
                        <RoleBadge role={r} />
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isAdmin && !isMe && (
                        <button onClick={() => { if (confirm(`Remove ${p.email}?`)) delUser.mutate(p.id); }}
                          className="text-xs text-destructive hover:underline">Remove</button>
                      )}
                      {isMe && <span className="text-xs text-muted-foreground italic">Cannot remove own account</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <AnimatePresence>
        {requestOpen && <NewUserDialog onClose={() => setRequestOpen(false)} onSubmit={(v) => requestUser.mutate(v)} pending={requestUser.isPending} />}
      </AnimatePresence>
    </PageContainer>
  );
}

function RoleBadge({ role }: { role: Role }) {
  const cfg = role === "admin" ? { c: "text-red-300 border-red-500/40 bg-red-500/10", i: ShieldAlert, l: "admin" }
    : role === "manager" ? { c: "text-sky-300 border-sky-500/40 bg-sky-500/10", i: Shield, l: "manager" }
    : { c: "text-zinc-300 border-zinc-500/40 bg-zinc-500/10", i: UserIcon, l: "user" };
  const Icon = cfg.i;
  return <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 rounded border ${cfg.c}`}><Icon className="w-3 h-3" /> {cfg.l}</span>;
}

function NewUserDialog({ onClose, onSubmit, pending }: {
  onClose: () => void;
  onSubmit: (v: { email: string; full_name: string; department: string; role: Role }) => void;
  pending: boolean;
}) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [department, setDepartment] = useState("");
  const [role, setRole] = useState<Role>("viewer");

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-strong rounded-2xl p-8 w-full max-w-md">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-xl font-bold">Request New User</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-cyan-glow/80 mb-6">This request will be sent to an admin for approval.</p>
        <div className="space-y-4">
          <Field label="Full Name *" v={fullName} on={setFullName} />
          <Field label="Email *" v={email} on={setEmail} type="email" />
          <Field label="Department" v={department} on={setDepartment} />
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value as Role)}
              className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:border-cyan-glow">
              <option value="viewer">User (view own assets)</option>
              <option value="manager">Manager (submit requests)</option>
              <option value="admin">Admin (full access)</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-white/5">Cancel</button>
          <button
            onClick={() => onSubmit({ email, full_name: fullName, department, role })}
            disabled={pending || !email || !fullName}
            className="rounded-lg bg-gradient-to-r from-electric to-cyan-glow text-navy-deep font-semibold px-5 py-2 text-sm flex items-center gap-2 disabled:opacity-50">
            <Send className="w-4 h-4" /> {pending ? "Sending…" : "Send Request"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Field({ label, v, on, type = "text" }: { label: string; v: string; on: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">{label}</label>
      <input type={type} value={v} onChange={(e) => on(e.target.value)}
        className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:border-cyan-glow" />
    </div>
  );
}

