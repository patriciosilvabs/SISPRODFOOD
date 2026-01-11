import { Progress } from "@/components/ui/progress";

interface StackProgressProps {
  total: number;
  atual: number;
}

export function StackProgress({ total, atual }: StackProgressProps) {
  const progresso = total > 0 ? (atual / total) * 100 : 0;
  
  return (
    <div className="mb-4">
      <div className="flex justify-between text-sm mb-1">
        <span className="font-medium">
          Lote {Math.min(atual + 1, total)} de {total}
        </span>
        <span className="text-muted-foreground">
          {Math.round(progresso)}% concluído
        </span>
      </div>
      <Progress value={progresso} className="h-2" />
    </div>
  );
}
