import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader, GlassCard } from "@/components/PageChrome";
import { useAuth, type Role } from "@/lib/auth";
import { toast } from "sonner";
import { Shield, ShieldAlert, User as UserIcon } from "lucide-react";

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

  return (
    <PageContainer>
      <PageHeader title="User Management" subtitle={isAdmin ? "Admins can promote, demote, and remove users." : "Read-only view."} />
      <GlassCard className="overflow-hidden">
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
                  <td className="px-4 py-3">{p.department || "—"}</td>
                  <td className="px-4 py-3">
                    {isAdmin && !isMe ? (
                      <select value={r} onChange={(e) => setRole.mutate({ userId: p.id, role: e.target.value as Role })}
                        className="rounded-md bg-input border border-border px-2 py-1 text-xs focus:outline-none focus:border-cyan-glow">
                        <option value="admin">Admin</option>
                        <option value="manager">Manager</option>
                        <option value="viewer">Viewer</option>
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
      </GlassCard>
    </PageContainer>
  );
}

function RoleBadge({ role }: { role: Role }) {
  const cfg = role === "admin" ? { c: "text-red-300 border-red-500/40 bg-red-500/10", i: ShieldAlert }
    : role === "manager" ? { c: "text-sky-300 border-sky-500/40 bg-sky-500/10", i: Shield }
    : { c: "text-zinc-300 border-zinc-500/40 bg-zinc-500/10", i: UserIcon };
  const Icon = cfg.i;
  return <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 rounded border ${cfg.c}`}><Icon className="w-3 h-3" /> {role}</span>;
}
