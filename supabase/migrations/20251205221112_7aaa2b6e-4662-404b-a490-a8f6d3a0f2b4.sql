-- Add policy to allow users to view their own membership record
-- This breaks the circular dependency where get_user_organization_id() needs to query organization_members
-- which itself was restricted by RLS policies that depend on get_user_organization_id()

CREATE POLICY "Users can view their own membership"
ON public.organization_members
FOR SELECT
TO authenticated
USING (user_id = auth.uid());