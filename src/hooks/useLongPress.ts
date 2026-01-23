import { useRef, useCallback, useEffect } from 'react';

interface UseLongPressOptions {
  onPress: () => void;
  initialDelay?: number;
  accelerationSteps?: { delay: number; interval: number }[];
}

export const useLongPress = ({
  onPress,
  initialDelay = 400,
  accelerationSteps = [
    { delay: 0, interval: 150 },
    { delay: 800, interval: 80 },
    { delay: 1500, interval: 40 },
  ],
}: UseLongPressOptions) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const isActiveRef = useRef<boolean>(false);

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    isActiveRef.current = false;
  }, []);

  const getIntervalForElapsed = useCallback((elapsed: number) => {
    let interval = accelerationSteps[0]?.interval ?? 150;
    for (const step of accelerationSteps) {
      if (elapsed >= step.delay) {
        interval = step.interval;
      }
    }
    return interval;
  }, [accelerationSteps]);

  const startRepeating = useCallback(() => {
    if (!isActiveRef.current) return;
    
    const elapsed = Date.now() - startTimeRef.current;
    const currentInterval = getIntervalForElapsed(elapsed);
    
    onPress();
    
    // Schedule next execution with potentially updated interval
    timerRef.current = setTimeout(startRepeating, currentInterval);
  }, [onPress, getIntervalForElapsed]);

  const start = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    
    if (isActiveRef.current) return;
    
    isActiveRef.current = true;
    startTimeRef.current = Date.now();
    
    // Execute immediately on first press
    onPress();
    
    // Start repeating after initial delay
    timerRef.current = setTimeout(startRepeating, initialDelay);
  }, [onPress, initialDelay, startRepeating]);

  const stop = useCallback(() => {
    clearTimers();
  }, [clearTimers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  return {
    onMouseDown: start,
    onMouseUp: stop,
    onMouseLeave: stop,
    onTouchStart: start,
    onTouchEnd: stop,
  };
};
