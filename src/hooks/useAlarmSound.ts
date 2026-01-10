import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';

export function useAlarmSound() {
  const { organizationId } = useOrganization();
  const [alarmUrl, setAlarmUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);

  const fetchAlarmUrl = useCallback(async () => {
    if (!organizationId) return;
    
    try {
      const { data, error } = await supabase
        .from('configuracoes_sistema')
        .select('valor')
        .eq('chave', 'alarm_sound_url')
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (error) throw error;
      setAlarmUrl(data?.valor || null);
    } catch (error) {
      console.error('Erro ao buscar som do alarme:', error);
    }
  }, [organizationId]);

  // Busca inicial
  useEffect(() => {
    if (organizationId) {
      fetchAlarmUrl();
    }
  }, [organizationId, fetchAlarmUrl]);

  // Listener Realtime para sincronizar alterações do som do alarme em todas as abas
  useEffect(() => {
    if (!organizationId) return;

    const channel = supabase
      .channel('alarm-sound-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'configuracoes_sistema',
          filter: `chave=eq.alarm_sound_url`
        },
        (payload) => {
          const newRecord = payload.new as { organization_id?: string; valor?: string };
          if (newRecord && newRecord.organization_id === organizationId) {
            console.log('Som do alarme atualizado via realtime:', newRecord.valor);
            setAlarmUrl(newRecord.valor || null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId]);

  const playAlarm = () => {
    // Se tem URL configurada, tocar o arquivo
    if (alarmUrl) {
      audioRef.current = new Audio(alarmUrl);
      audioRef.current.loop = true;
      audioRef.current.play().catch((err) => {
        console.error('Erro ao tocar alarme:', err);
        playDefaultBeep();
      });
    } else {
      // Se não tem URL, tocar beep padrão
      playDefaultBeep();
    }
  };

  const playDefaultBeep = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800; // Frequência em Hz
      oscillator.type = 'sine';
      gainNode.gain.value = 0.3; // Volume

      oscillator.start();
      oscillatorRef.current = oscillator;

      // Criar efeito de beep intermitente
      const beepInterval = setInterval(() => {
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0, audioContext.currentTime + 0.2);
      }, 500);

      // Armazenar interval para poder limpar depois
      (oscillatorRef.current as any).beepInterval = beepInterval;
    } catch (error) {
      console.error('Erro ao criar beep padrão:', error);
    }
  };

  const stopAlarm = () => {
    // Parar arquivo de áudio se estiver tocando
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }

    // Parar oscillator se estiver tocando
    if (oscillatorRef.current) {
      try {
        const interval = (oscillatorRef.current as any).beepInterval;
        if (interval) clearInterval(interval);
        oscillatorRef.current.stop();
        oscillatorRef.current = null;
      } catch (error) {
        console.error('Erro ao parar beep:', error);
      }
    }
  };

  return { playAlarm, stopAlarm, refreshAlarmUrl: fetchAlarmUrl };
}
