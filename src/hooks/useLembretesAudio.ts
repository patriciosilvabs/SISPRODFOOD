import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';

interface LembreteAudio {
  id: string;
  titulo: string;
  descricao: string | null;
  audio_url: string;
  horario: string;
  dias_semana: number[];
  ativo: boolean;
  perfis_destino: string[];
}

export function useLembretesAudio() {
  const { organizationId } = useOrganization();
  const { roles } = useAuth();
  const [lembretes, setLembretes] = useState<LembreteAudio[]>([]);
  const [loading, setLoading] = useState(true);
  const [lembreteAtivo, setLembreteAtivo] = useState<LembreteAudio | null>(null);
  const lembretesExibidosRef = useRef<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const fetchLembretes = useCallback(async () => {
    if (!organizationId) return;
    
    try {
      const { data, error } = await supabase
        .from('lembretes_audio')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('ativo', true);

      if (error) throw error;
      
      // Filtrar lembretes pelo perfil do usuário
      const lembretesFiltrados = (data || []).filter(lembrete => {
        // Se perfis_destino está vazio, mostra para todos
        if (!lembrete.perfis_destino || lembrete.perfis_destino.length === 0) {
          return true;
        }
        // Verifica se algum role do usuário está na lista de destino
        return lembrete.perfis_destino.some(perfil => roles.includes(perfil));
      });
      
      setLembretes(lembretesFiltrados);
    } catch (error) {
      console.error('Erro ao buscar lembretes:', error);
    } finally {
      setLoading(false);
    }
  }, [organizationId, roles]);

  useEffect(() => {
    fetchLembretes();
  }, [fetchLembretes]);

  // Limpar lembretes exibidos à meia-noite
  useEffect(() => {
    const checkMidnight = () => {
      const now = new Date();
      if (now.getHours() === 0 && now.getMinutes() === 0) {
        lembretesExibidosRef.current.clear();
      }
    };

    const interval = setInterval(checkMidnight, 60000);
    return () => clearInterval(interval);
  }, []);

  const verificarHorario = useCallback(() => {
    const now = new Date();
    const diaAtual = now.getDay(); // 0 = domingo, 1 = segunda...
    const horaAtual = now.getHours().toString().padStart(2, '0');
    const minutoAtual = now.getMinutes().toString().padStart(2, '0');
    const horarioAtual = `${horaAtual}:${minutoAtual}`;

    for (const lembrete of lembretes) {
      // Verifica se é o dia certo
      if (!lembrete.dias_semana.includes(diaAtual)) continue;

      // Extrai hora e minuto do lembrete (formato HH:MM:SS)
      const [horaLembrete, minutoLembrete] = lembrete.horario.split(':');
      const horarioLembrete = `${horaLembrete}:${minutoLembrete}`;

      // Verifica se já foi exibido hoje
      const chaveExibicao = `${lembrete.id}-${now.toDateString()}`;
      if (lembretesExibidosRef.current.has(chaveExibicao)) continue;

      // Verifica se o horário bate (com tolerância de 1 minuto)
      if (horarioAtual === horarioLembrete) {
        lembretesExibidosRef.current.add(chaveExibicao);
        setLembreteAtivo(lembrete);
        break;
      }
    }
  }, [lembretes]);

  // Verificar a cada 30 segundos
  useEffect(() => {
    if (lembretes.length === 0) return;

    verificarHorario(); // Verificar imediatamente
    const interval = setInterval(verificarHorario, 30000);
    
    return () => clearInterval(interval);
  }, [lembretes, verificarHorario]);

  const tocarAudio = useCallback(() => {
    if (!lembreteAtivo) return;
    
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    audioRef.current = new Audio(lembreteAtivo.audio_url);
    audioRef.current.play().catch(err => {
      console.error('Erro ao tocar áudio:', err);
    });
  }, [lembreteAtivo]);

  const pararAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
  }, []);

  const dispensarLembrete = useCallback(() => {
    pararAudio();
    setLembreteAtivo(null);
  }, [pararAudio]);

  return {
    lembretes,
    loading,
    lembreteAtivo,
    tocarAudio,
    pararAudio,
    dispensarLembrete,
    refetch: fetchLembretes
  };
}
