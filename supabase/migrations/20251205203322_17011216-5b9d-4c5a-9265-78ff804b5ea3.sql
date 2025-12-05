-- Drop the problematic policy that queries auth.users directly
DROP POLICY IF EXISTS "Users can view their own pending invites" ON convites_pendentes;

-- Create new policy using auth.email() instead of querying auth.users
CREATE POLICY "Users can view their own pending invites"
ON convites_pendentes
FOR SELECT
USING (
  (lower(email) = lower(auth.email())) 
  AND (status = 'pendente'::text)
);

-- Add policy for SuperAdmin to view all invites
CREATE POLICY "SuperAdmin can view all invites"
ON convites_pendentes
FOR SELECT
USING (is_super_admin(auth.uid()));