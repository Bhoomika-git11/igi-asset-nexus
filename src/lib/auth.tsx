import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Role = "admin" | "manager" | "viewer";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  role: Role | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null, session: null, role: null, loading: true,
  signOut: async () => {}, refreshRole: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  const loadRole = async (uid: string) => {
    const { data } = await supabase.rpc("get_my_role" as never);
    setRole((data as Role | null) ?? "viewer");
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) loadRole(data.session.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      setSession(sess);
      if (sess?.user) setTimeout(() => loadRole(sess.user.id), 0);
      else setRole(null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <Ctx.Provider value={{
      user: session?.user ?? null, session, role, loading,
      signOut: async () => { await supabase.auth.signOut(); },
      refreshRole: async () => { if (session?.user) await loadRole(session.user.id); },
    }}>{children}</Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
// Admin has direct edit. Manager can only submit change requests. Viewer (regular User) is read-only.
export const canEdit = (r: Role | null) => r === "admin";
export const canDelete = (r: Role | null) => r === "admin";
export const canRequest = (r: Role | null) => r === "manager";
export const roleLabel = (r: Role | null) => (r === "viewer" ? "user" : (r ?? "user"));

