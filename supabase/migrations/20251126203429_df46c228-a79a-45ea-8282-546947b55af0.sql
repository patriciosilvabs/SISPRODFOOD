-- Criar tabela de reserva diária por item
CREATE TABLE public.itens_reserva_diaria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_porcionado_id UUID NOT NULL REFERENCES public.itens_porcionados(id) ON DELETE CASCADE,
  segunda INTEGER NOT NULL DEFAULT 0,
  terca INTEGER NOT NULL DEFAULT 0,
  quarta INTEGER NOT NULL DEFAULT 0,
  quinta INTEGER NOT NULL DEFAULT 0,
  sexta INTEGER NOT NULL DEFAULT 0,
  sabado INTEGER NOT NULL DEFAULT 0,
  domingo INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(item_porcionado_id)
);

-- RLS policies
ALTER TABLE public.itens_reserva_diaria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar reservas diárias"
ON public.itens_reserva_diaria
FOR ALL
USING (is_admin(auth.uid()));

CREATE POLICY "Usuários autenticados podem visualizar reservas diárias"
ON public.itens_reserva_diaria
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Adicionar campos de tracking de reserva em producao_registros
ALTER TABLE public.producao_registros
ADD COLUMN demanda_lojas INTEGER,
ADD COLUMN reserva_configurada INTEGER,
ADD COLUMN sobra_reserva INTEGER;

COMMENT ON COLUMN public.producao_registros.demanda_lojas IS 'Quantidade solicitada pelas lojas (sem reserva)';
COMMENT ON COLUMN public.producao_registros.reserva_configurada IS 'Reserva mínima do dia configurada pelo gestor';
COMMENT ON COLUMN public.producao_registros.sobra_reserva IS 'Sobra destinada à reserva após arredondamento';

-- Trigger para atualizar updated_at
CREATE TRIGGER update_itens_reserva_diaria_updated_at
BEFORE UPDATE ON public.itens_reserva_diaria
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();