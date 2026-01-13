import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface JanelaContagem {
  janela_contagem_inicio: string | null;
  janela_contagem_fim: string | null;
  fuso_horario: string;
}

interface JanelaStatus {
  status: 'antes' | 'dentro' | 'depois';
  horaInicio: string;
  horaFim: string;
  horaAtual: string;
  tempoAteAbrir?: string;
  tempoAteFechar?: string;
  mensagem: string;
}

export const useJanelaContagem = (lojaIds: string[]) => {
  const [janelaStatus, setJanelaStatus] = useState<Record<string, JanelaStatus>>({});
  const [loading, setLoading] = useState(true);

  const formatTime = (time: string | null): string => {
    if (!time) return '22:00';
    return time.slice(0, 5);
  };

  const calcularTempoRestante = (horaAlvo: string, horaAtual: string): string => {
    const [alvoH, alvoM] = horaAlvo.split(':').map(Number);
    const [atualH, atualM] = horaAtual.split(':').map(Number);
    
    let diffMinutos = (alvoH * 60 + alvoM) - (atualH * 60 + atualM);
    
    // Se for negativo, a hora alvo é no dia seguinte
    if (diffMinutos < 0) {
      diffMinutos += 24 * 60;
    }
    
    const horas = Math.floor(diffMinutos / 60);
    const minutos = diffMinutos % 60;
    
    if (horas > 0) {
      return `${horas}h ${minutos}min`;
    }
    return `${minutos}min`;
  };

  const verificarPosicaoNaJanela = (
    horaAtual: string,
    horaInicio: string,
    horaFim: string
  ): 'antes' | 'dentro' | 'depois' => {
    const [atualH, atualM] = horaAtual.split(':').map(Number);
    const [inicioH, inicioM] = horaInicio.split(':').map(Number);
    const [fimH, fimM] = horaFim.split(':').map(Number);
    
    const atualMinutos = atualH * 60 + atualM;
    const inicioMinutos = inicioH * 60 + inicioM;
    const fimMinutos = fimH * 60 + fimM;
    
    // Caso especial: janela cruza meia-noite (ex: 22:00 -> 02:00)
    if (inicioMinutos > fimMinutos) {
      // Estamos "dentro" se hora atual >= início OU hora atual < fim
      if (atualMinutos >= inicioMinutos || atualMinutos < fimMinutos) {
        return 'dentro';
      }
      // Se hora atual é entre fim e início, está "depois" (janela fechou)
      if (atualMinutos >= fimMinutos && atualMinutos < inicioMinutos) {
        return 'depois';
      }
      return 'antes';
    }
    
    // Caso normal: janela não cruza meia-noite (ex: 08:00 -> 12:00)
    if (atualMinutos < inicioMinutos) {
      return 'antes';
    }
    if (atualMinutos >= inicioMinutos && atualMinutos < fimMinutos) {
      return 'dentro';
    }
    return 'depois';
  };

  const verificarJanelas = useCallback(async () => {
    if (lojaIds.length === 0) {
      setLoading(false);
      return;
    }

    try {
      const { data: lojas, error } = await supabase
        .from('lojas')
        .select('id, janela_contagem_inicio, janela_contagem_fim, fuso_horario')
        .in('id', lojaIds);

      if (error) throw error;

      const newStatus: Record<string, JanelaStatus> = {};

      for (const loja of lojas || []) {
        const horaInicio = formatTime(loja.janela_contagem_inicio);
        const horaFim = formatTime(loja.janela_contagem_fim);
        
        // Obter hora atual no fuso horário da loja
        const now = new Date();
        const options: Intl.DateTimeFormatOptions = {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: loja.fuso_horario || 'America/Sao_Paulo',
        };
        const horaAtual = now.toLocaleTimeString('pt-BR', options);
        
        const status = verificarPosicaoNaJanela(horaAtual, horaInicio, horaFim);
        
        let mensagem = '';
        let tempoAteAbrir: string | undefined;
        let tempoAteFechar: string | undefined;
        
        switch (status) {
          case 'antes':
            tempoAteAbrir = calcularTempoRestante(horaInicio, horaAtual);
            mensagem = `Contagem abre às ${horaInicio} (em ${tempoAteAbrir})`;
            break;
          case 'dentro':
            tempoAteFechar = calcularTempoRestante(horaFim, horaAtual);
            mensagem = `Janela aberta até ${horaFim} (${tempoAteFechar} restantes)`;
            break;
          case 'depois':
            mensagem = `Janela encerrada às ${horaFim}. Apenas Produção Extra disponível.`;
            break;
        }

        newStatus[loja.id] = {
          status,
          horaInicio,
          horaFim,
          horaAtual,
          tempoAteAbrir,
          tempoAteFechar,
          mensagem,
        };
      }

      setJanelaStatus(newStatus);
    } catch (error) {
      console.error('Erro ao verificar janelas de contagem:', error);
    } finally {
      setLoading(false);
    }
  }, [lojaIds]);

  useEffect(() => {
    verificarJanelas();
    
    // Atualizar a cada minuto
    const interval = setInterval(verificarJanelas, 60000);
    
    return () => clearInterval(interval);
  }, [verificarJanelas]);

  const getStatusLoja = (lojaId: string): JanelaStatus | undefined => {
    return janelaStatus[lojaId];
  };

  const isDentroJanela = (lojaId: string): boolean => {
    return janelaStatus[lojaId]?.status === 'dentro';
  };

  const isAntesJanela = (lojaId: string): boolean => {
    return janelaStatus[lojaId]?.status === 'antes';
  };

  const isDepoisJanela = (lojaId: string): boolean => {
    return janelaStatus[lojaId]?.status === 'depois';
  };

  return {
    janelaStatus,
    loading,
    getStatusLoja,
    isDentroJanela,
    isAntesJanela,
    isDepoisJanela,
    refresh: verificarJanelas,
  };
};
