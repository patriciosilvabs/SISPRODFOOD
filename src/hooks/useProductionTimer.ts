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
        isActive: remaining > 0, // Só ativo se ainda tem tempo
        secondsRemaining: remaining,
        isFinished: remaining === 0,
      };
    };

    // Calcular estado inicial
    const initialState = calculateTimeRemaining();
    setState(initialState);

    // Só configurar interval se ainda não terminou
    if (initialState.secondsRemaining > 0) {
      const interval = setInterval(() => {
        const newState = calculateTimeRemaining();
        setState(newState);
        
        // Se terminou, parar o interval
        if (newState.secondsRemaining === 0) {
          clearInterval(interval);
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [itemId, timerMinutes, timerAtivo, dataInicioPreparo]);

  return state;
}
