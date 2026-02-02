-- Adicionar coluna loja_id à tabela mapeamento_cardapio_itens
ALTER TABLE mapeamento_cardapio_itens 
ADD COLUMN loja_id UUID REFERENCES lojas(id) ON DELETE CASCADE;

-- Remover constraint antiga (se existir)
ALTER TABLE mapeamento_cardapio_itens 
DROP CONSTRAINT IF EXISTS mapeamento_cardapio_itens_organization_id_cardapio_item_id_i_key;

-- Criar nova constraint UNIQUE incluindo loja_id
-- Permite o mesmo produto ter mapeamentos diferentes por loja
ALTER TABLE mapeamento_cardapio_itens 
ADD CONSTRAINT mapeamento_cardapio_itens_org_loja_item_unique 
UNIQUE(organization_id, loja_id, cardapio_item_id, item_porcionado_id);