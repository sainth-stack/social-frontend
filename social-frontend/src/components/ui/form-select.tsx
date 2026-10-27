"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type FormSelectOption = { value: string; label: string; disabled?: boolean };

export type FormSelectProps = {
  id?: string;
  label: string;
  options: readonly FormSelectOption[];
  value: string;
  onValueChange: (value: string) => void;
  helper?: ReactNode;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
};

export function FormSelect({ id, label, options, value, onValueChange, helper, disabled = false, placeholder = "Choose an option", className }: FormSelectProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const [open, setOpen] = useState(false);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  return <div className={cn("min-w-0 space-y-2", className)}>
    <label id={`${controlId}-label`} htmlFor={controlId} className="block text-sm font-medium">{label}</label>
    <Select value={value} disabled={disabled} open={open && !disabled} onOpenChange={next => setOpen(next && !disabled)} onValueChange={next => { if (!disabled) onValueChange(next); }}>
      <SelectTrigger id={controlId} aria-labelledby={`${controlId}-label`} aria-describedby={helper ? `${controlId}-helper` : undefined} className="min-h-11 bg-background text-left transition-colors hover:border-primary/50 focus:ring-2 disabled:hover:border-input">
        <SelectValue placeholder={placeholder}>{options.find(option => option.value === value)?.label ?? (value || undefined)}</SelectValue>
      </SelectTrigger>
      <SelectContent>{options.map(option => <SelectItem key={option.value} value={option.value} disabled={disabled || option.disabled} className="min-h-11 cursor-pointer">{option.label}</SelectItem>)}</SelectContent>
    </Select>
    {helper && <p id={`${controlId}-helper`} className="text-xs leading-relaxed text-muted-foreground">{helper}</p>}
  </div>;
}