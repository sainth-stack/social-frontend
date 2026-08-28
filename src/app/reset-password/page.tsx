"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { z } from "zod";

import authApi from "@/api/endpoints/auth.api";
import { toApiError } from "@/api/errors";
import SparkAuthLayout from "@/components/auth/SparkAuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password is too long");

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | undefined>();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      setErr("Reset link is missing or invalid.");
      return;
    }
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      setErr(parsed.error.issues[0]?.message ?? "Invalid password");
      return;
    }
    if (password !== confirm) {
      setErr("Passwords do not match");
      return;
    }
    setErr(undefined);
    setLoading(true);
    try {
      await authApi.resetPassword(token, parsed.data);
      setDone(true);
      setTimeout(() => router.replace("/login"), 1800);
    } catch (error) {
      setErr(toApiError(error).message);
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <SparkAuthLayout
        title="Invalid reset link"
        subtitle="This password reset link is missing or incomplete."
        footer={
          <Link href="/forgot-password" className="font-medium text-primary hover:underline">
            Request a new link
          </Link>
        }
      >
        <p className="text-sm text-muted-foreground text-center">
          Ask for a fresh reset email and try again.
        </p>
      </SparkAuthLayout>
    );
  }

  if (done) {
    return (
      <SparkAuthLayout
        title="Password updated"
        subtitle="You can sign in with your new password."
        footer={
          <Link href="/login" className="font-medium text-primary hover:underline">
            Go to sign in
          </Link>
        }
      >
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/15 text-success">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <p className="text-sm text-muted-foreground">Redirecting to login…</p>
        </div>
      </SparkAuthLayout>
    );
  }

  return (
    <SparkAuthLayout
      title="Set a new password"
      subtitle="Choose a strong password for your OpsBrain account."
      footer={
        <Link href="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
          {err ? <p className="text-xs text-destructive">{err}</p> : null}
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
            </>
          ) : (
            "Update password"
          )}
        </Button>
      </form>
    </SparkAuthLayout>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
