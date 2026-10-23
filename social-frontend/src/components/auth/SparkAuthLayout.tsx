"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { OpsBrainLogo } from "@/components/brand/OpsBrainLogo";

type SparkAuthLayoutProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
};

export default function SparkAuthLayout({
  title,
  subtitle,
  children,
  footer,
}: SparkAuthLayoutProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center">
          <OpsBrainLogo size={36} priority />
        </Link>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-elevated sm:p-8">
          <div className="mb-6 space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
            {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
          {children}
        </div>

        {footer ? (
          <p className="mt-6 text-center text-sm text-muted-foreground">{footer}</p>
        ) : (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            <Link href="/login" className="font-medium text-primary hover:underline">
              Back to sign in
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

/** Google SSO — wire up from login/register when GOOGLE_* env is configured. */
export function GoogleButton({
  label = "Continue with Google",
  onClick,
}: {
  label?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.56c2.08-1.92 3.28-4.74 3.28-8.1Z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.56-2.77c-.98.66-2.24 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.2 1.65l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.29 9.14 5.38 12 5.38Z"
        />
      </svg>
      {label}
    </button>
  );
}

export function OrDivider() {
  return (
    <div className="my-5 flex items-center gap-3">
      <div className="h-px flex-1 bg-border" />
      <span className="text-xs uppercase tracking-wider text-muted-foreground">or</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}
