-- Add RLS policy to allow users to view profiles of members in their organization
CREATE POLICY "Users can view profiles in their organization"
ON public.profiles
FOR SELECT
USING (
  id IN (
    SELECT om.user_id 
    FROM organization_members om 
    WHERE om.organization_id = get_user_organization_id(auth.uid())
  )
);