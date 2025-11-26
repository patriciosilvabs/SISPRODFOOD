import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface StepIndicatorProps {
  step: number;
  current: number;
  label: string;
}

export const StepIndicator = ({ step, current, label }: StepIndicatorProps) => {
  const isCompleted = current > step;
  const isCurrent = current === step;
  const isUpcoming = current < step;

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all',
          isCompleted && 'border-primary bg-primary text-primary-foreground',
          isCurrent && 'border-primary bg-background text-primary',
          isUpcoming && 'border-muted-foreground/30 bg-background text-muted-foreground'
        )}
      >
        {isCompleted ? <Check className="h-5 w-5" /> : <span className="font-semibold">{step}</span>}
      </div>
      <span
        className={cn(
          'text-sm font-medium transition-all',
          (isCompleted || isCurrent) && 'text-foreground',
          isUpcoming && 'text-muted-foreground'
        )}
      >
        {label}
      </span>
      {step < 3 && (
        <div
          className={cn(
            'mx-2 h-0.5 w-12 transition-all',
            isCompleted && 'bg-primary',
            !isCompleted && 'bg-muted-foreground/30'
          )}
        />
      )}
    </div>
  );
};
