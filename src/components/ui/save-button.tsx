import * as React from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SaveButtonProps {
  isDirty: boolean;
  isSaving: boolean;
  onClick: () => void;
  className?: string;
  size?: "default" | "sm" | "lg" | "icon";
  children?: React.ReactNode;
}

export function SaveButton({ 
  isDirty, 
  isSaving, 
  onClick, 
  className,
  size = "sm",
  children = "Salvar"
}: SaveButtonProps) {
  const isDisabled = !isDirty || isSaving;
  
  return (
    <Button
      size={size}
      onClick={onClick}
      disabled={isDisabled}
      className={cn(
        "transition-all duration-200",
        isDirty 
          ? "bg-blue-600 hover:bg-blue-700 text-white"
          : "bg-muted opacity-60 cursor-not-allowed text-muted-foreground hover:bg-muted",
        className
      )}
    >
      {isSaving ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin mr-1" />
          Salvando...
        </>
      ) : (
        children
      )}
    </Button>
  );
}
