"use client";

import { forwardRef, useId, type ComponentProps, type ReactNode } from "react";
import { Input } from "./input";
import { Textarea } from "./textarea";
import { cn } from "@/lib/utils";

type FieldProps = { label: string; helper?: ReactNode; error?: string; trailing?: ReactNode; className?: string };

export function FormField({ id, label, helper, error, trailing, className, children }: FieldProps & { id: string; children: ReactNode }) {
  return <div className={cn("min-w-0 space-y-2", className)}>
    <div className="flex items-center justify-between gap-3"><label htmlFor={id} className="text-sm font-medium">{label}</label>{trailing && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{trailing}</span>}</div>
    {children}
    {(error || helper) && <p id={`${id}-help`} role={error ? "alert" : undefined} className={cn("text-xs leading-relaxed text-muted-foreground", error && "text-destructive")}>{error || helper}</p>}
  </div>;
}

export const FormInput = forwardRef<HTMLInputElement, ComponentProps<"input"> & FieldProps>(function FormInput({ id: suppliedId, label, helper, error, trailing, className, ...props }, ref) {
  const generated = useId();
  const id = suppliedId ?? generated;
  return <FormField id={id} label={label} helper={helper} error={error} trailing={trailing}><Input {...props} id={id} ref={ref} aria-invalid={error ? true : props["aria-invalid"]} aria-describedby={[props["aria-describedby"], (helper || error) && `${id}-help`].filter(Boolean).join(" ") || undefined} className={cn("min-h-11 rounded-lg bg-background transition-shadow focus-visible:ring-2 focus-visible:ring-ring/25 aria-invalid:border-destructive", className)} /></FormField>;
});

export const FormTextarea = forwardRef<HTMLTextAreaElement, ComponentProps<"textarea"> & FieldProps>(function FormTextarea({ id: suppliedId, label, helper, error, trailing, className, ...props }, ref) {
  const generated = useId();
  const id = suppliedId ?? generated;
  return <FormField id={id} label={label} helper={helper} error={error} trailing={trailing}><Textarea {...props} id={id} ref={ref} aria-invalid={error ? true : props["aria-invalid"]} aria-describedby={[props["aria-describedby"], (helper || error) && `${id}-help`].filter(Boolean).join(" ") || undefined} className={cn("resize-y rounded-lg bg-background px-3 py-3 leading-relaxed transition-shadow focus-visible:ring-2 focus-visible:ring-ring/25 aria-invalid:border-destructive", className)} /></FormField>;
});