-- Adicionar novos valores ao enum unidade_medida
ALTER TYPE unidade_medida ADD VALUE IF NOT EXISTS 'lote_sem_perda';
ALTER TYPE unidade_medida ADD VALUE IF NOT EXISTS 'saco';
ALTER TYPE unidade_medida ADD VALUE IF NOT EXISTS 'caixa';
ALTER TYPE unidade_medida ADD VALUE IF NOT EXISTS 'fardo';