import { Clock, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimerDisplayProps {
  secondsRemaining: number;
  isFinished: boolean;
}

export function TimerDisplay({ secondsRemaining, isFinished }: TimerDisplayProps) {
  // Converter segundos para formato MM:SS
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  // Determinar cor baseado no tempo restante
  const getColorClass = () => {
    if (isFinished) {
      return 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 border-red-300 dark:border-red-800';
    }
    if (secondsRemaining < 60) {
      return 'bg-yellow-100 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-400 border-yellow-300 dark:border-yellow-800';
    }
    return 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-800';
  };

  return (
    <div
      className={cn(
        'rounded-lg p-3 border-2 transition-all',
        getColorClass(),
        isFinished && 'animate-pulse'
      )}
    >
      <div className="flex items-center justify-center gap-2">
        {isFinished ? (
          <Bell className="h-5 w-5 animate-bounce" />
        ) : (
          <Clock className="h-5 w-5" />
        )}
        <div className="text-center">
          <div className="text-2xl font-bold font-mono">{timeString}</div>
          <div className="text-xs font-medium mt-0.5">
            {isFinished ? 'TEMPO ESGOTADO!' : 'restante'}
          </div>
        </div>
      </div>
    </div>
  );
}
