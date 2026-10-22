"use client";

import { forwardRef, useId, useImperativeHandle, useRef, useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type AuthFormFieldProps = ComponentProps<"input"> & {
  label: string;
  error?: string;
  hint?: string;
  password?: boolean;
};

export const AuthFormField = forwardRef<HTMLInputElement, AuthFormFieldProps>(
  ({ label, error, hint, password = false, id, type, className, "aria-describedby": describedBy, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const inputRef = useRef<HTMLInputElement>(null);
    const [visible, setVisible] = useState(false);
    useImperativeHandle(ref, () => inputRef.current!);
    const description = [describedBy, hint ? `${inputId}-hint` : undefined, error ? `${inputId}-error` : undefined].filter(Boolean).join(" ") || undefined;

    return (
      <div className="min-w-0 space-y-2">
        <Label htmlFor={inputId} className="text-sm font-medium text-foreground">{label}</Label>
        <div className="relative">
          <Input
            {...props}
            ref={inputRef}
            id={inputId}
            type={password ? (visible ? "text" : "password") : type}
            aria-invalid={error ? true : props["aria-invalid"]}
            aria-describedby={description}
            className={cn("h-12 rounded-xl bg-background px-4 shadow-sm focus-visible:ring-2 aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive", password && "pr-14", className)}
          />
          {password ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={props.disabled}
              aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
              aria-controls={inputId}
              aria-pressed={visible}
              className="absolute right-1 top-1 h-10 w-10 rounded-lg text-muted-foreground focus-visible:ring-2"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setVisible((value) => !value);
                inputRef.current?.focus({ preventScroll: true });
              }}
            >
              {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </Button>
          ) : null}
        </div>
        {hint ? <p id={`${inputId}-hint`} className="text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
        {error ? <p id={`${inputId}-error`} className="text-xs font-medium text-destructive">{error}</p> : null}
      </div>
    );
  },
);
AuthFormField.displayName = "AuthFormField";

export function AuthPasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const score = Number(password.length >= 8) + Number(password.length >= 12) + Number(/[A-Z]/.test(password)) + Number(/[0-9]/.test(password)) + Number(/[^A-Za-z0-9]/.test(password));
  const strength = score <= 2 ? 1 : score <= 3 ? 2 : score <= 4 ? 3 : 4;
  const label = ["Weak", "Fair", "Good", "Strong"][strength - 1];
  return (
    <div className="space-y-2 pt-2">
      <div className="flex gap-1.5" aria-hidden="true">
        {[1, 2, 3, 4].map((segment) => <span key={segment} className={cn("h-1 flex-1 rounded-full", segment <= strength ? "bg-primary" : "bg-muted")} />)}
      </div>
      <p className="text-xs text-muted-foreground">Password strength: <span className="font-medium text-foreground">{label}</span></p>
    </div>
  );
}