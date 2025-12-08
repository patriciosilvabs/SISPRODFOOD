import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { numberToWords } from '@/lib/numberToWords';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface VolumeInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  placeholder?: string;
  helperText?: string;
  compact?: boolean;
  showLabel?: boolean;
}

export function VolumeInput({
  value,
  onChange,
  label = "Quantidade de Volumes",
  required = false,
  placeholder = "Ex: 3",
  helperText,
  compact = false,
  showLabel = true,
}: VolumeInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [extenso, setExtenso] = useState('');

  useEffect(() => {
    if (value && !isFocused) {
      const numValue = parseInt(value, 10);
      if (!isNaN(numValue) && numValue > 0) {
        setExtenso(numberToWords(numValue, 'volume'));
      } else {
        setExtenso('');
      }
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    onChange(rawValue);
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (value) {
      const numValue = parseInt(value, 10);
      if (!isNaN(numValue) && numValue > 0) {
        setExtenso(numberToWords(numValue, 'volume'));
      }
    }
  };

  return (
    <div className={compact ? "space-y-1" : "space-y-2"}>
      {showLabel && (
        <Label className={compact ? "text-xs" : "text-sm"}>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      <Input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={handleChange}
        onFocus={() => setIsFocused(true)}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={compact ? "h-8 text-sm" : ""}
        required={required}
      />
      {extenso && !isFocused && (
        <p className="text-xs text-muted-foreground italic truncate">
          {extenso}
        </p>
      )}
      {helperText && (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      )}
    </div>
  );
}

interface VolumeInputInlineProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function VolumeInputInline({
  value,
  onChange,
  placeholder = "Vol.",
  className = "",
}: VolumeInputInlineProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [extenso, setExtenso] = useState('');

  useEffect(() => {
    if (value && !isFocused) {
      const numValue = parseInt(value, 10);
      if (!isNaN(numValue) && numValue > 0) {
        setExtenso(numberToWords(numValue, 'volume'));
      } else {
        setExtenso('');
      }
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    onChange(rawValue);
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (value) {
      const numValue = parseInt(value, 10);
      if (!isNaN(numValue) && numValue > 0) {
        setExtenso(numberToWords(numValue, 'volume'));
      }
    }
  };

  return (
    <div className="space-y-1">
      <Input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={handleChange}
        onFocus={() => setIsFocused(true)}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={`h-8 text-sm ${className}`}
      />
      {extenso && !isFocused && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="text-xs text-muted-foreground italic truncate cursor-help">
                {extenso}
              </p>
            </TooltipTrigger>
            <TooltipContent>
              <p>{extenso}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
