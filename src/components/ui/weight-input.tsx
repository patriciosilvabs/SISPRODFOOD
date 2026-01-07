import * as React from "react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPesoParaInput, parsePesoProgressivo } from "@/lib/weightUtils";
import { pesoProgressivoToWords } from "@/lib/numberToWords";
import { cn } from "@/lib/utils";

interface WeightInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  placeholder?: string;
  helperText?: string;
  className?: string;
  inputClassName?: string;
  showLabel?: boolean;
  compact?: boolean;
}

export function WeightInput({
  value,
  onChange,
  label = "Peso",
  required = false,
  placeholder = "0",
  helperText,
  className,
  inputClassName,
  showLabel = true,
  compact = false,
}: WeightInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Permite apenas dígitos
    const rawValue = e.target.value.replace(/\D/g, '');
    onChange(rawValue);
  };

  const parsed = parsePesoProgressivo(value);
  const hasValue = parsed.valorRaw > 0;

  // Quando focado: mostra número puro para facilitar digitação
  // Quando desfocado: mostra valor formatado (ex: "5,5 kg")
  const displayValue = isFocused ? value : (hasValue ? formatPesoParaInput(value) : '');

  return (
    <div className={cn("space-y-1", className)}>
      {showLabel && label && (
        <Label className={cn(compact && "text-xs")}>
          {label} {required && <span className="text-destructive">*</span>}
        </Label>
      )}
      <Input
        type="text"
        inputMode="numeric"
        placeholder={placeholder}
        value={displayValue}
        onChange={handleChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className={cn(compact && "h-8 text-sm", inputClassName)}
      />
      {hasValue && !isFocused && (
        <p className="text-primary text-xs font-medium">
          {pesoProgressivoToWords(value)}
        </p>
      )}
      {helperText && (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      )}
    </div>
  );
}

// Versão inline mais compacta para tabelas/grids
export function WeightInputInline({
  value,
  onChange,
  placeholder = "0",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [isFocused, setIsFocused] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    onChange(rawValue);
  };

  const parsed = parsePesoProgressivo(value);
  const hasValue = parsed.valorRaw > 0;

  const displayValue = isFocused ? value : (hasValue ? formatPesoParaInput(value) : '');

  return (
    <div className={cn("space-y-0.5", className)}>
      <Input
        type="text"
        inputMode="numeric"
        placeholder={placeholder}
        value={displayValue}
        onChange={handleChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className="h-12 text-center text-base font-medium"
      />
      {hasValue && !isFocused && (
        <p className="text-xs text-muted-foreground truncate" title={pesoProgressivoToWords(value)}>
          {pesoProgressivoToWords(value)}
        </p>
      )}
    </div>
  );
}
