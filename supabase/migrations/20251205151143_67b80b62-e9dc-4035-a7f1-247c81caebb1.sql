
-- Add subscription fields to organizations table
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS trial_start_date TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'expired', 'cancelled', 'pending_payment')),
ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS woovi_customer_id TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS woovi_subscription_id TEXT DEFAULT NULL;

-- Create subscription_history table for payment records
CREATE TABLE IF NOT EXISTS public.subscription_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('trial_started', 'payment_received', 'subscription_activated', 'subscription_expired', 'subscription_cancelled', 'payment_failed')),
  amount_cents INTEGER DEFAULT NULL,
  payment_method TEXT DEFAULT NULL,
  woovi_charge_id TEXT DEFAULT NULL,
  woovi_correlation_id TEXT DEFAULT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on subscription_history
ALTER TABLE public.subscription_history ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view their organization's subscription history
CREATE POLICY "Admins can view subscription history"
ON public.subscription_history
FOR SELECT
USING (
  organization_id = get_user_organization_id(auth.uid()) 
  AND has_role(auth.uid(), 'Admin'::app_role)
);

-- Policy: Only system (via service role) can insert subscription history
-- No user-facing INSERT policy - inserts happen via edge functions with service_role

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_subscription_history_org_id ON public.subscription_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_organizations_subscription_status ON public.organizations(subscription_status);

-- Update existing organizations to have trial dates set
UPDATE public.organizations 
SET 
  trial_start_date = COALESCE(trial_start_date, created_at),
  trial_end_date = COALESCE(trial_end_date, created_at + INTERVAL '7 days')
WHERE trial_start_date IS NULL OR trial_end_date IS NULL;
