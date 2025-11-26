import { useState, useEffect } from 'react';

interface TimerState {
  isActive: boolean;
  secondsRemaining: number;
  isFinished: boolean;
}

export function useProductionTimer(
  itemId: string,
  timerMinutes: number,
  timerAtivo: boolean,
  dataInicioPreparo: string | null
): TimerState {
  const [state, setState] = useState<TimerState>({
    isActive: false,
    secondsRemaining: 0,
    isFinished: false,
  });

  useEffect(() => {
    // Se não tem timer ativo ou não iniciou preparo, não fazer nada
    if (!timerAtivo || !dataInicioPreparo) {
      setState({ isActive: false, secondsRemaining: 0, isFinished: false });
      return;
    }

    // Calcular tempo decorrido desde início do preparo
    const calculateTimeRemaining = () => {
      const startTime = new Date(dataInicioPreparo).getTime();
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - startTime) / 1000);
      const totalSeconds = timerMinutes * 60;
      const remaining = Math.max(0, totalSeconds - elapsedSeconds);

      return {
        isActive: true,
        secondsRemaining: remaining,
        isFinished: remaining === 0,
      };
    };

    // Atualizar a cada segundo
    const interval = setInterval(() => {
      setState(calculateTimeRemaining());
    }, 1000);

    // Calcular estado inicial
    setState(calculateTimeRemaining());

    return () => clearInterval(interval);
  }, [itemId, timerMinutes, timerAtivo, dataInicioPreparo]);

  return state;
}
