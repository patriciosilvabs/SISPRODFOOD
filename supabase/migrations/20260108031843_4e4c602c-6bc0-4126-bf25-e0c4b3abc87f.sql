-- Create table for audio reminders
CREATE TABLE public.lembretes_audio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  audio_url TEXT NOT NULL,
  horario TIME NOT NULL,
  dias_semana INTEGER[] DEFAULT '{1,2,3,4,5,6,0}',
  ativo BOOLEAN DEFAULT true,
  perfis_destino TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lembretes_audio ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view reminders from their organization
CREATE POLICY "Users can view reminders from their organization"
ON public.lembretes_audio
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

-- Policy: Admins can insert reminders
CREATE POLICY "Admins can insert reminders"
ON public.lembretes_audio
FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid() AND is_admin = true
  )
);

-- Policy: Admins can update reminders
CREATE POLICY "Admins can update reminders"
ON public.lembretes_audio
FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid() AND is_admin = true
  )
);

-- Policy: Admins can delete reminders
CREATE POLICY "Admins can delete reminders"
ON public.lembretes_audio
FOR DELETE
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid() AND is_admin = true
  )
);

-- Create storage bucket for audio files
INSERT INTO storage.buckets (id, name, public)
VALUES ('lembretes-audio', 'lembretes-audio', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for lembretes-audio bucket
CREATE POLICY "Anyone can view audio files"
ON storage.objects
FOR SELECT
USING (bucket_id = 'lembretes-audio');

CREATE POLICY "Authenticated users can upload audio files"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'lembretes-audio' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update their audio files"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'lembretes-audio' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete audio files"
ON storage.objects
FOR DELETE
USING (bucket_id = 'lembretes-audio' AND auth.role() = 'authenticated');