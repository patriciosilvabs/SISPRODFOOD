import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { useAuditLog } from './useAuditLog';

interface CalibragemResult {
  massaTotalUtilizadaG: number;
  pesoMedioRealBolinhaG: number;
  statusCalibracao: 'dentro_do_padrao' | 'fora_do_padrao_abaixo' | 'fora_do_padrao_acima';
  dentroDoLimite: boolean;
  desvioG: number;
  novoPesoMedioOperacional: number | null;
}

interface ItemMasseira {
  id: string;
  nome: string;
  peso_minimo_bolinha_g: number;
  peso_maximo_bolinha_g: number;
  peso_medio_operacional_bolinha_g: number | null;
  farinha_por_lote_kg: number;
  massa_gerada_por_lote_kg: number;
}

interface FinalizacaoMasseiraParams {
  itemId: string;
  producaoRegistroId: string;
  lotesProducidos: number;
  quantidadeEsperada: number;
  quantidadeRealProduzida: number;
  pesoFinalG: number;
  sobraPerdaG: number;
}

export const useMediaMovelMassa = () => {
  const { user, profile } = useAuth();
  const { organizationId } = useOrganization();
  const { log } = useAuditLog();

  /**
   * Calcula estatísticas de calibragem baseado nos valores informados
   */
  const calcularCalibragem = useCallback((
    pesoFinalG: number,
    sobraPerdaG: number,
    quantidadeRealProduzida: number,
    pesoMinimoG: number,
    pesoMaximoG: number
  ): CalibragemResult => {
    // Massa total utilizada = peso final + sobra/perda
    const massaTotalUtilizadaG = pesoFinalG + sobraPerdaG;
    
    // Peso médio real da bolinha = massa total / quantidade real
    const pesoMedioRealBolinhaG = quantidadeRealProduzida > 0 
      ? massaTotalUtilizadaG / quantidadeRealProduzida 
      : 0;

    // Determinar status de calibragem
    let statusCalibracao: CalibragemResult['statusCalibracao'] = 'dentro_do_padrao';
    let dentroDoLimite = true;
    let desvioG = 0;

    if (pesoMedioRealBolinhaG < pesoMinimoG) {
      statusCalibracao = 'fora_do_padrao_abaixo';
      dentroDoLimite = false;
      desvioG = pesoMinimoG - pesoMedioRealBolinhaG;
    } else if (pesoMedioRealBolinhaG > pesoMaximoG) {
      statusCalibracao = 'fora_do_padrao_acima';
      dentroDoLimite = false;
      desvioG = pesoMedioRealBolinhaG - pesoMaximoG;
    }

    return {
      massaTotalUtilizadaG,
      pesoMedioRealBolinhaG,
      statusCalibracao,
      dentroDoLimite,
      desvioG,
      novoPesoMedioOperacional: null // Será calculado posteriormente
    };
  }, []);

  /**
   * Busca os últimos 10 registros de histórico para calcular média móvel
   */
  const calcularMediaMovel = useCallback(async (itemId: string): Promise<number | null> => {
    try {
      const { data, error } = await supabase
        .from('producao_massa_historico')
        .select('peso_medio_real_bolinha_g')
        .eq('item_id', itemId)
        .order('created_at', { ascending: false })
        .limit(20); // Buscar mais para ter margem após filtro

      if (error) throw error;
      if (!data || data.length === 0) return null;

      // CRÍTICO: Filtrar outliers antes de calcular média
      // Apenas considerar registros com peso médio entre 200g e 800g (faixa plausível para bolinhas)
      const registrosValidos = data.filter(item => 
        item.peso_medio_real_bolinha_g && 
        item.peso_medio_real_bolinha_g >= 200 && 
        item.peso_medio_real_bolinha_g <= 800
      );

      if (registrosValidos.length === 0) return null;

      // Usar no máximo 10 registros válidos para a média
      const registrosParaMedia = registrosValidos.slice(0, 10);
      const soma = registrosParaMedia.reduce((acc, item) => acc + (item.peso_medio_real_bolinha_g || 0), 0);
      const media = soma / registrosParaMedia.length;

      return Math.round(media * 100) / 100; // 2 casas decimais
    } catch (error) {
      console.error('Erro ao calcular média móvel:', error);
      return null;
    }
  }, []);

  /**
   * Busca dados do item masseira
   */
  const buscarDadosItemMasseira = useCallback(async (itemId: string): Promise<ItemMasseira | null> => {
    try {
      const { data, error } = await supabase
        .from('itens_porcionados')
        .select(`
          id,
          nome,
          peso_minimo_bolinha_g,
          peso_maximo_bolinha_g,
          peso_medio_operacional_bolinha_g,
          farinha_por_lote_kg,
          massa_gerada_por_lote_kg
        `)
        .eq('id', itemId)
        .single();

      if (error) throw error;
      return data as ItemMasseira;
    } catch (error) {
      console.error('Erro ao buscar dados do item masseira:', error);
      return null;
    }
  }, []);

  /**
   * Registra finalização de produção masseira com calibragem e média móvel
   */
  const registrarFinalizacaoMasseira = useCallback(async (
    params: FinalizacaoMasseiraParams
  ): Promise<{ success: boolean; calibragem: CalibragemResult | null; error?: string }> => {
    if (!user || !organizationId) {
      return { success: false, calibragem: null, error: 'Usuário ou organização não identificados' };
    }

    try {
      // 1. Buscar dados do item masseira
      const item = await buscarDadosItemMasseira(params.itemId);
      if (!item) {
        return { success: false, calibragem: null, error: 'Item masseira não encontrado' };
      }

      if (!item.peso_minimo_bolinha_g || !item.peso_maximo_bolinha_g) {
        return { success: false, calibragem: null, error: 'Faixa de peso não configurada no item' };
      }

      // 2. Calcular calibragem
      const calibragem = calcularCalibragem(
        params.pesoFinalG,
        params.sobraPerdaG,
        params.quantidadeRealProduzida,
        item.peso_minimo_bolinha_g,
        item.peso_maximo_bolinha_g
      );

      const pesoMedioAnterior = item.peso_medio_operacional_bolinha_g;

      // 3. Registrar no histórico
      const { error: historicoError } = await supabase
        .from('producao_massa_historico')
        .insert({
          item_id: params.itemId,
          producao_registro_id: params.producaoRegistroId,
          lotes_produzidos: params.lotesProducidos,
          quantidade_esperada: params.quantidadeEsperada,
          quantidade_real_produzida: params.quantidadeRealProduzida,
          peso_final_g: params.pesoFinalG,
          sobra_perda_g: params.sobraPerdaG,
          massa_total_utilizada_g: calibragem.massaTotalUtilizadaG,
          peso_medio_real_bolinha_g: calibragem.pesoMedioRealBolinhaG,
          status_calibracao: calibragem.statusCalibracao,
          peso_medio_operacional_anterior_g: pesoMedioAnterior,
          usuario_id: user.id,
          usuario_nome: profile?.nome || user.email || 'Usuário',
          organization_id: organizationId,
        } as any);

      if (historicoError) throw historicoError;

      // 4. Calcular nova média móvel (com o novo registro incluído)
      const novaMedia = await calcularMediaMovel(params.itemId);
      calibragem.novoPesoMedioOperacional = novaMedia;

      // 5. Atualizar peso médio operacional no item (se houver média calculada)
      if (novaMedia) {
        await supabase
          .from('itens_porcionados')
          .update({ peso_medio_operacional_bolinha_g: novaMedia })
          .eq('id', params.itemId);

        // Atualizar o registro de histórico com o novo peso médio
        await supabase
          .from('producao_massa_historico')
          .update({ novo_peso_medio_operacional_g: novaMedia } as any)
          .eq('producao_registro_id', params.producaoRegistroId);
      }

      // 6. Atualizar registro de produção com dados de masseira
      await supabase
        .from('producao_registros')
        .update({
          lotes_masseira: params.lotesProducidos,
          farinha_consumida_kg: params.lotesProducidos * item.farinha_por_lote_kg,
          massa_total_gerada_kg: calibragem.massaTotalUtilizadaG / 1000,
          peso_medio_real_bolinha_g: calibragem.pesoMedioRealBolinhaG,
          status_calibracao: calibragem.statusCalibracao,
        } as any)
        .eq('id', params.producaoRegistroId);

      // 7. Registrar em audit_logs
      await log('user.update', 'role', params.itemId, {
        acao: 'finalizacao_masseira',
        item_nome: item.nome,
        lotes_produzidos: String(params.lotesProducidos),
        quantidade_esperada: String(params.quantidadeEsperada),
        quantidade_real: String(params.quantidadeRealProduzida),
        peso_final_g: String(params.pesoFinalG),
        sobra_g: String(params.sobraPerdaG),
        massa_utilizada_kg: String(calibragem.massaTotalUtilizadaG / 1000),
        peso_medio_real_g: String(calibragem.pesoMedioRealBolinhaG),
        status: calibragem.statusCalibracao,
        peso_medio_anterior_g: String(pesoMedioAnterior || 0),
        novo_peso_medio_g: String(novaMedia || 0),
      });

      // 8. Exibir alertas se fora do padrão
      if (!calibragem.dentroDoLimite) {
        const tipoDesvio = calibragem.statusCalibracao === 'fora_do_padrao_abaixo' ? 'ABAIXO' : 'ACIMA';
        toast.warning(
          `⚠️ Porcionadora Fora da Faixa!\n` +
          `Peso médio: ${calibragem.pesoMedioRealBolinhaG.toFixed(1)}g\n` +
          `Faixa: ${item.peso_minimo_bolinha_g}g a ${item.peso_maximo_bolinha_g}g\n` +
          `Status: ${tipoDesvio} (${calibragem.desvioG.toFixed(1)}g de desvio)`,
          { duration: 8000 }
        );
      }

      return { success: true, calibragem };
    } catch (error: any) {
      console.error('Erro ao registrar finalização masseira:', error);
      return { success: false, calibragem: null, error: error.message };
    }
  }, [user, organizationId, profile, calcularCalibragem, calcularMediaMovel, buscarDadosItemMasseira, log]);

  /**
   * Calcula lotes e farinha necessários para uma demanda
   * @param margemPercentual - Margem de flexibilização para evitar lotes extras (ex: 15 = 15%)
   */
  const calcularProducaoMasseira = useCallback((
    demandaUnidades: number,
    massaGeradaPorLoteKg: number,
    pesoMedioOperacionalG: number,
    farinhaPorLoteKg: number,
    margemPercentual: number = 0
  ): { 
    lotesNecessarios: number;
    farinhaKg: number;
    unidadesEstimadas: number;
    massaTotalKg: number;
    capacidadeComMargem: number;
  } => {
    // Unidades por lote = massa gerada / peso médio bolinha
    const unidadesPorLote = massaGeradaPorLoteKg / (pesoMedioOperacionalG / 1000);
    
    // Aplicar margem ao cálculo de capacidade
    const capacidadeComMargem = unidadesPorLote * (1 + margemPercentual / 100);
    
    // Lotes necessários (arredondando para cima, usando capacidade com margem)
    const lotesNecessarios = Math.ceil(demandaUnidades / capacidadeComMargem);
    
    // Farinha total necessária
    const farinhaKg = lotesNecessarios * farinhaPorLoteKg;
    
    // Unidades estimadas que serão produzidas (lotes reais × unidades por lote)
    const unidadesEstimadas = Math.floor(lotesNecessarios * unidadesPorLote);
    
    // Massa total que será gerada
    const massaTotalKg = lotesNecessarios * massaGeradaPorLoteKg;

    return {
      lotesNecessarios,
      farinhaKg,
      unidadesEstimadas,
      massaTotalKg,
      capacidadeComMargem,
    };
  }, []);

  return {
    calcularCalibragem,
    calcularMediaMovel,
    registrarFinalizacaoMasseira,
    calcularProducaoMasseira,
    buscarDadosItemMasseira,
  };
};
