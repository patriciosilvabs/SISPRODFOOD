-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can check org existence" ON public.organizations;

-- Create a secure function to check if a slug exists (returns only boolean)
CREATE OR REPLACE FUNCTION public.check_slug_exists(slug_to_check text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations WHERE slug = slug_to_check
  );
$$;