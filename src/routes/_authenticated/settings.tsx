import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader, GlassCard } from "@/components/PageChrome";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Save } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({ component: SettingsPage });

function SettingsPage() {
  const { user, role } = useAuth();
  const [fullName, setFullName] = useState("");
  const [department, setDepartment] = useState("");
  const [contact, setContact] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).single().then(({ data }) => {
      if (data) { setFullName(data.full_name ?? ""); setDepartment(data.department ?? ""); setContact(data.contact ?? ""); }
    });
  }, [user]);

  const save = async () => {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from("profiles").update({ full_name: fullName, department, contact }).eq("id", user.id);
    setLoading(false);
    if (error) toast.error(error.message); else toast.success("Profile updated");
  };

  return (
    <PageContainer>
      <PageHeader title="Settings" subtitle="Your profile and access." />
      <div className="grid md:grid-cols-2 gap-6 max-w-4xl">
        <GlassCard className="p-6">
          <h3 className="font-semibold mb-4">Profile</h3>
          <div className="space-y-4">
            <Field label="Email" value={user?.email ?? ""} disabled />
            <Field label="Full name" value={fullName} onChange={setFullName} />
            <Field label="Department" value={department} onChange={setDepartment} />
            <Field label="Contact" value={contact} onChange={setContact} />
            <button onClick={save} disabled={loading} className="rounded-lg bg-gradient-to-r from-electric to-cyan-glow text-navy-deep font-semibold px-5 py-2 text-sm flex items-center gap-2 disabled:opacity-50">
              <Save className="w-4 h-4" /> {loading ? "Saving…" : "Save"}
            </button>
          </div>
        </GlassCard>
        <GlassCard className="p-6">
          <h3 className="font-semibold mb-4">Access</h3>
          <div className="space-y-3 text-sm">
            <Row k="Current role" v={<span className="text-cyan-glow uppercase font-semibold">{role}</span>} />
            <Row k="User ID" v={<code className="text-xs text-muted-foreground">{user?.id}</code>} />
            <Row k="Signed in" v={user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : "—"} />
          </div>
          <div className="mt-6 p-4 rounded-lg bg-white/[0.03] border border-border/40 text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground block mb-1">Role permissions</strong>
            <div>Admin — full access, delete, user management</div>
            <div>Manager — add & edit assets and categories</div>
            <div>Viewer — read-only + export</div>
          </div>
        </GlassCard>
      </div>
    </PageContainer>
  );
}

function Field({ label, value, onChange, disabled }: { label: string; value: string; onChange?: (v: string) => void; disabled?: boolean }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">{label}</label>
      <input value={value} disabled={disabled} onChange={(e) => onChange?.(e.target.value)}
        className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:border-cyan-glow disabled:opacity-60" />
    </div>
  );
}
function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex justify-between items-center py-1"><span className="text-muted-foreground">{k}</span><span>{v}</span></div>;
}
