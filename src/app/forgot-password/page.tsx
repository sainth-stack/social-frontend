"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import { z } from "zod";

import authApi from "@/api/endpoints/auth.api";
import SparkAuthLayout from "@/components/auth/SparkAuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toApiError } from "@/api/errors";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | undefined>();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = z.string().email().safeParse(email);
    if (!parsed.success) {
      setErr("Enter a valid email");
      return;
    }
    setErr(undefined);
    setLoading(true);
    try {
      await authApi.forgotPassword(parsed.data);
      setSent(true);
    } catch (error) {
      setErr(toApiError(error).message);
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <SparkAuthLayout
        title="Check your email"
        subtitle={`If an account exists for ${email}, we sent a reset link.`}
        footer={
          <Link href="/login" className="font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        }
      >
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/15 text-success">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <p className="text-sm text-muted-foreground">
            The link expires in 60 minutes. Didn&apos;t get it? Check spam or{" "}
            <button type="button" className="text-primary hover:underline" onClick={() => setSent(false)}>
              try again
            </button>
            .
          </p>
        </div>
      </SparkAuthLayout>
    );
  }

  return (
    <SparkAuthLayout
      title="Forgot your password?"
      subtitle="Enter your email and we'll send you a reset link."
      footer={
        <Link href="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
            autoFocus
          />
          {err ? <p className="text-xs text-destructive">{err}</p> : null}
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…
            </>
          ) : (
            "Send reset link"
          )}
        </Button>
      </form>
    </SparkAuthLayout>
  );
}
