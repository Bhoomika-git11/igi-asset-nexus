
-- Approval workflow + tightened RLS + assigned-user visibility

-- 1) Approval requests table
CREATE TABLE IF NOT EXISTS public.approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type TEXT NOT NULL CHECK (request_type IN ('create_asset','update_asset','delete_asset','create_user')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  target_id UUID,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary TEXT,
  requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_by_email TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by_email TEXT,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.approval_requests TO authenticated;
GRANT ALL ON public.approval_requests TO service_role;

ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

-- Managers and admins can create requests
CREATE POLICY "requests_insert_mgr_admin" ON public.approval_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    requested_by = auth.uid()
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  );

-- Requesters see their own; admins see all
CREATE POLICY "requests_select_own_or_admin" ON public.approval_requests
  FOR SELECT TO authenticated
  USING (requested_by = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- Only admins update (approve/reject)
CREATE POLICY "requests_update_admin" ON public.approval_requests
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Only admins delete
CREATE POLICY "requests_delete_admin" ON public.approval_requests
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER approval_requests_updated_at BEFORE UPDATE ON public.approval_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) Helper: is inventory row assigned to current user?
CREATE OR REPLACE FUNCTION public.inv_assigned_to_me(_assigned_to TEXT, _name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        (_assigned_to IS NOT NULL AND (
          LOWER(_assigned_to) = LOWER(COALESCE(p.full_name,'')) OR
          LOWER(_assigned_to) = LOWER(p.email) OR
          LOWER(_assigned_to) LIKE LOWER(COALESCE(p.full_name,'')) || '%'
        ))
        OR
        (_name IS NOT NULL AND (
          LOWER(_name) = LOWER(COALESCE(p.full_name,'')) OR
          LOWER(_name) LIKE LOWER(COALESCE(p.full_name,'')) || '%'
        ))
      )
  );
$$;

-- 3) Tighten inventory RLS:
--    - admin/manager: read all
--    - viewer (regular user): read only rows assigned to them
--    - only admin can directly INSERT/UPDATE/DELETE (managers must use approval flow)
DROP POLICY IF EXISTS inv_select_auth ON public.inventory;
DROP POLICY IF EXISTS inv_insert_mgr ON public.inventory;
DROP POLICY IF EXISTS inv_update_mgr ON public.inventory;
DROP POLICY IF EXISTS inv_delete_admin ON public.inventory;

CREATE POLICY "inv_select_admin_mgr" ON public.inventory
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

CREATE POLICY "inv_select_own_viewer" ON public.inventory
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'viewer') AND public.inv_assigned_to_me(assigned_to, name));

CREATE POLICY "inv_insert_admin" ON public.inventory
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "inv_update_admin" ON public.inventory
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "inv_delete_admin" ON public.inventory
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
