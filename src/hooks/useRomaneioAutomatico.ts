import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DetalheLojaProducao {
  loja_id: string;
  loja_nome: string;
  quantidade: number;
}

interface RomaneioAutomaticoResult {
  success: boolean;
  romaneiosCriados: number;
  error?: string;
}

/**
 * Hook para criar romaneios automaticamente ao finalizar produção
 * REGRAS:
 * - Só cria romaneio se estoque CPD >= demanda TOTAL de todas as lojas
 * - Não duplica: verifica se já existe romaneio para producao_registro_id + item
 * - Status: aguardando_conferencia (operador informa peso/volumes depois)
 */
export const useRomaneioAutomatico = () => {
  
  /**
   * Cria romaneios automaticamente após finalização de produção
   * @param producaoRegistroId - ID do registro de produção finalizado
   * @param itemId - ID do item porcionado
   * @param itemNome - Nome do item
   * @param detalhesLojas - Array com demandas por loja
   * @param unidadesProduzidas - Quantidade real produzida
   * @param organizationId - ID da organização
   * @param userId - ID do usuário
   * @param userName - Nome do usuário
   */
  const criarRomaneiosAutomaticos = async (
    producaoRegistroId: string,
    itemId: string,
    itemNome: string,
    detalhesLojas: DetalheLojaProducao[],
    unidadesProduzidas: number,
    organizationId: string,
    userId: string,
    userName: string
  ): Promise<RomaneioAutomaticoResult> => {
    try {
      console.log('[Romaneio Auto] Iniciando criação automática...', {
        producaoRegistroId,
        itemId,
        itemNome,
        detalhesLojas,
        unidadesProduzidas
      });

      // 0. Validação básica
      if (!detalhesLojas || detalhesLojas.length === 0) {
        console.log('[Romaneio Auto] Sem detalhes de lojas - nenhum romaneio criado');
        return { success: true, romaneiosCriados: 0 };
      }

      // 1. Buscar estoque CPD atual
      const { data: estoqueCPD, error: estoqueError } = await supabase
        .from('estoque_cpd')
        .select('quantidade')
        .eq('item_porcionado_id', itemId)
        .maybeSingle();

      if (estoqueError) {
        console.error('[Romaneio Auto] Erro ao buscar estoque CPD:', estoqueError);
        return { success: false, romaneiosCriados: 0, error: 'Erro ao verificar estoque CPD' };
      }

      const estoqueDisponivel = estoqueCPD?.quantidade || 0;
      console.log('[Romaneio Auto] Estoque CPD disponível:', estoqueDisponivel);

      // 2. Calcular demanda total de todas as lojas
      const demandaTotal = detalhesLojas.reduce((acc, d) => acc + d.quantidade, 0);
      console.log('[Romaneio Auto] Demanda total:', demandaTotal);

      // 3. Se estoque insuficiente, não criar romaneio (aguardar estoque completo)
      if (estoqueDisponivel < demandaTotal) {
        console.log(`[Romaneio Auto] ⏳ Estoque insuficiente. Disponível: ${estoqueDisponivel}, Demanda: ${demandaTotal}. Aguardando...`);
        return { success: true, romaneiosCriados: 0 };
      }

      // 4. Verificar se já existe romaneio_itens para esta produção (evitar duplicação)
      const { data: romaneioExistente } = await supabase
        .from('romaneio_itens')
        .select('id')
        .eq('producao_registro_id', producaoRegistroId)
        .eq('item_porcionado_id', itemId)
        .limit(1);

      if (romaneioExistente && romaneioExistente.length > 0) {
        console.log('[Romaneio Auto] ⚠️ Romaneio já existe para esta produção - ignorando');
        return { success: true, romaneiosCriados: 0 };
      }

      // 5. Criar romaneios para cada loja com demanda
      let romaneiosCriados = 0;
      const agora = new Date().toISOString();

      for (const detalhe of detalhesLojas) {
        if (detalhe.quantidade <= 0) continue;

        // Verificar se já existe romaneio pendente de conferência para esta loja
        let { data: romaneio } = await supabase
          .from('romaneios')
          .select('id')
          .eq('loja_id', detalhe.loja_id)
          .eq('status', 'aguardando_conferencia')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        // Se não existe, criar novo romaneio
        if (!romaneio) {
          const { data: novoRomaneio, error: createError } = await supabase
            .from('romaneios')
            .insert({
              loja_id: detalhe.loja_id,
              loja_nome: detalhe.loja_nome,
              status: 'aguardando_conferencia',
              data_criacao: agora,
              usuario_id: userId,
              usuario_nome: userName,
              organization_id: organizationId,
              observacao: 'Criado automaticamente ao finalizar produção'
            })
            .select('id')
            .single();

          if (createError) {
            console.error(`[Romaneio Auto] Erro ao criar romaneio para ${detalhe.loja_nome}:`, createError);
            continue;
          }
          romaneio = novoRomaneio;
          console.log(`[Romaneio Auto] ✅ Novo romaneio criado para ${detalhe.loja_nome}: ${romaneio.id}`);
        }

        // Inserir item no romaneio (peso e volumes serão preenchidos pelo operador)
        const { error: itemError } = await supabase.from('romaneio_itens').insert({
          romaneio_id: romaneio.id,
          item_porcionado_id: itemId,
          item_nome: itemNome,
          quantidade: detalhe.quantidade,
          peso_total_kg: 0, // Será preenchido pelo operador
          quantidade_volumes: 0, // Será preenchido pelo operador
          producao_registro_id: producaoRegistroId,
          organization_id: organizationId
        });

        if (itemError) {
          console.error(`[Romaneio Auto] Erro ao inserir item no romaneio:`, itemError);
          continue;
        }

        romaneiosCriados++;
        console.log(`[Romaneio Auto] ✅ Item adicionado: ${itemNome} -> ${detalhe.loja_nome} (${detalhe.quantidade} un)`);
      }

      if (romaneiosCriados > 0) {
        toast.info(`📦 Romaneio criado automaticamente para ${romaneiosCriados} loja(s). Confira peso e volumes antes de enviar.`);
      }

      return { success: true, romaneiosCriados };
    } catch (error) {
      console.error('[Romaneio Auto] Erro inesperado:', error);
      return { success: false, romaneiosCriados: 0, error: 'Erro inesperado ao criar romaneio' };
    }
  };

  /**
   * Busca produções finalizadas sem romaneio criado (fallback manual)
   * Útil quando o romaneio automático falhou por falta de estoque que foi posteriormente reposto
   */
  const buscarProducoesPendentes = async (organizationId: string): Promise<number> => {
    try {
      console.log('[Romaneio Auto] Buscando produções pendentes...');

      // Buscar data do servidor
      const { data: serverDate } = await supabase.rpc('get_current_date');
      const hoje = serverDate || new Date().toISOString().split('T')[0];
      
      // Calcular 2 dias atrás
      const doisDiasAtras = new Date(hoje);
      doisDiasAtras.setDate(doisDiasAtras.getDate() - 2);
      const dataLimite = doisDiasAtras.toISOString().split('T')[0];

      // Buscar produções finalizadas dos últimos 2 dias com detalhes_lojas
      const { data: producoes, error: prodError } = await supabase
        .from('producao_registros')
        .select('id, item_id, item_nome, detalhes_lojas, unidades_reais')
        .eq('status', 'finalizado')
        .gte('data_referencia', dataLimite)
        .not('detalhes_lojas', 'is', null);

      if (prodError) {
        console.error('[Romaneio Auto] Erro ao buscar produções:', prodError);
        return 0;
      }

      // Filtrar produções com detalhes_lojas válidos
      const producoesValidas = producoes?.filter(p => {
        const detalhes = p.detalhes_lojas as Array<any> | null;
        return detalhes && Array.isArray(detalhes) && detalhes.length > 0;
      }) || [];

      console.log(`[Romaneio Auto] ${producoesValidas.length} produções encontradas`);

      // Buscar romaneio_itens já criados para estas produções
      const producaoIds = producoesValidas.map(p => p.id);
      const { data: romaneiosExistentes } = await supabase
        .from('romaneio_itens')
        .select('producao_registro_id')
        .in('producao_registro_id', producaoIds);

      const producaoIdsComRomaneio = new Set(romaneiosExistentes?.map(r => r.producao_registro_id) || []);

      // Filtrar produções SEM romaneio
      const producoesSemRomaneio = producoesValidas.filter(p => !producaoIdsComRomaneio.has(p.id));
      console.log(`[Romaneio Auto] ${producoesSemRomaneio.length} produções SEM romaneio`);

      // Para cada produção sem romaneio, verificar estoque e criar se possível
      let romaneiosCriados = 0;

      // Buscar usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;

      const { data: userProfile } = await supabase
        .from('profiles')
        .select('nome')
        .eq('id', user.id)
        .single();

      for (const producao of producoesSemRomaneio) {
        const detalhes = producao.detalhes_lojas as unknown as DetalheLojaProducao[];
        
        const result = await criarRomaneiosAutomaticos(
          producao.id,
          producao.item_id,
          producao.item_nome,
          detalhes,
          producao.unidades_reais || 0,
          organizationId,
          user.id,
          userProfile?.nome || 'Sistema'
        );

        if (result.romaneiosCriados > 0) {
          romaneiosCriados += result.romaneiosCriados;
        }
      }

      if (romaneiosCriados > 0) {
        toast.success(`✅ ${romaneiosCriados} romaneio(s) criado(s) com sucesso!`);
      } else {
        toast.info('Nenhum romaneio pendente encontrado.');
      }

      return romaneiosCriados;
    } catch (error) {
      console.error('[Romaneio Auto] Erro ao buscar pendentes:', error);
      toast.error('Erro ao buscar produções pendentes');
      return 0;
    }
  };

  return {
    criarRomaneiosAutomaticos,
    buscarProducoesPendentes
  };
};
