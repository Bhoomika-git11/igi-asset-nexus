
-- audit_log: restrict read to admin, remove permissive insert (trigger handles inserts as SECURITY DEFINER)
DROP POLICY IF EXISTS audit_select_auth ON public.audit_log;
DROP POLICY IF EXISTS audit_insert_auth ON public.audit_log;
CREATE POLICY audit_select_admin ON public.audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- profiles: own row, or admin/manager can read all
DROP POLICY IF EXISTS profiles_select_all_auth ON public.profiles;
CREATE POLICY profiles_select_own_or_staff ON public.profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
  );

-- user_roles: own row or admin
DROP POLICY IF EXISTS roles_select_auth ON public.user_roles;
CREATE POLICY roles_select_own_or_admin ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Lock down SECURITY DEFINER functions.
-- Trigger-only functions: no caller ever needs EXECUTE.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_inventory() FROM PUBLIC, anon, authenticated;

-- Helper functions used by RLS / client RPC: revoke from public and anon; keep authenticated.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.inv_assigned_to_me(text, text) FROM PUBLIC, anon;
