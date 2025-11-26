-- Criar bucket para sons de alarme
INSERT INTO storage.buckets (id, name, public)
VALUES ('alarm-sounds', 'alarm-sounds', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de acesso para alarm-sounds
CREATE POLICY "Admins podem gerenciar sons de alarme"
ON storage.objects FOR ALL USING (
  bucket_id = 'alarm-sounds' AND (
    has_role(auth.uid(), 'Admin') OR 
    has_role(auth.uid(), 'Produção')
  )
);

CREATE POLICY "Usuários autenticados podem visualizar sons"
ON storage.objects FOR SELECT USING (
  bucket_id = 'alarm-sounds' AND auth.uid() IS NOT NULL
);

-- Criar tabela de configurações do sistema
CREATE TABLE IF NOT EXISTS configuracoes_sistema (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  chave text UNIQUE NOT NULL,
  valor text,
  updated_at timestamp with time zone DEFAULT now()
);

-- Inserir configuração padrão para som do alarme
INSERT INTO configuracoes_sistema (chave, valor) 
VALUES ('alarm_sound_url', NULL)
ON CONFLICT (chave) DO NOTHING;

-- RLS policies para configuracoes_sistema
ALTER TABLE configuracoes_sistema ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar configurações"
ON configuracoes_sistema FOR ALL USING (
  has_role(auth.uid(), 'Admin')
);

CREATE POLICY "Usuários autenticados podem visualizar configurações"
ON configuracoes_sistema FOR SELECT USING (
  auth.uid() IS NOT NULL
);