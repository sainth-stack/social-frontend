"use client";

import { useEffect, useId, useRef, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Loader2 } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import AuthCardShell from "@/components/auth/AuthCardShell";
import { AuthFormField } from "@/components/auth/AuthFormFields";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  clearAuthError,
  selectAuthError,
  selectAuthLoading,
  selectIsAuthenticated,
  selectIsAuthHydrated,
  selectUser,
} from "@/features/auth/authSlice";
import { login } from "@/features/auth/authThunks";
import { resolvePostLoginPath } from "@/lib/auth/users";
import { prefetchDashboardHome } from "@/lib/dashboard-cache";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

const REMEMBER_EMAIL_KEY = "opsbrain_remember_email";

const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
  remember: z.boolean().default(true),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();
  const authError = useAppSelector(selectAuthError);
  const authLoading = useAppSelector(selectAuthLoading);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isHydrated = useAppSelector(selectIsAuthHydrated);
  const user = useAppSelector(selectUser);
  const submitting = useRef(false);
  const rememberId = useId();

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof loginSchema>, unknown, LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      remember: true,
    },
    mode: "onSubmit",
  });

  useEffect(() => {
    dispatch(clearAuthError());
    try {
      const savedEmail = window.localStorage.getItem(REMEMBER_EMAIL_KEY);
      if (savedEmail) setValue("email", savedEmail);
    } catch {}
    router.prefetch("/dashboard");
  }, [dispatch, router, setValue]);

  useEffect(() => {
    if (!isHydrated || !isAuthenticated || !user) return;
    if (!user.isPlatformAdmin && user.workspaceId) prefetchDashboardHome(user.workspaceId);
    const redirect = searchParams.get("redirect");
    router.replace(resolvePostLoginPath(user, redirect));
  }, [isAuthenticated, isHydrated, router, searchParams, user]);

  const busy = isSubmitting || authLoading;
  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current || busy) return;
    submitting.current = true;
    try {
      await handleSubmit(async (values) => {
        dispatch(clearAuthError());
        try {
          if (values.remember) window.localStorage.setItem(REMEMBER_EMAIL_KEY, values.email);
          else window.localStorage.removeItem(REMEMBER_EMAIL_KEY);
        } catch {}
        try {
          await dispatch(login({ email: values.email, password: values.password })).unwrap();
        } catch {}
      })(event);
    } finally {
      submitting.current = false;
    }
  };

  return (
    <AuthCardShell
      title="Welcome back"
      subtitle="Sign in to plan, publish, and measure social content across your channels."
      footer={
        <>
          New to EarnedVoice?{" "}
          <Link href="/register" className="rounded-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate aria-busy={busy} className="space-y-5">
          {authError ? (
            <div role="alert" className="rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {authError}
            </div>
          ) : null}
          <AuthFormField
            label="Work email"
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="you@company.com"
            error={errors.email?.message}
            disabled={busy}
            {...register("email")}
          />

          <div className="space-y-2">
            <AuthFormField
              label="Password"
              password
              autoComplete="current-password"
              placeholder="Enter your password"
              error={errors.password?.message}
              disabled={busy}
              {...register("password")}
            />
            <div className="text-right">
              <Link href="/forgot-password" className="rounded-sm text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Forgot password?</Link>
            </div>
          </div>

          <Controller
            name="remember"
            control={control}
            render={({ field }) => (
              <div className="flex items-start gap-3">
                  <Checkbox
                    id={rememberId}
                    name={field.name}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                    disabled={busy}
                    aria-describedby={`${rememberId}-hint`}
                    className="mt-0.5 h-5 w-5 rounded-md focus-visible:ring-2"
                  />
                <div className="space-y-1">
                  <Label htmlFor={rememberId} className="text-sm">Remember my email</Label>
                  <p id={`${rememberId}-hint`} className="text-xs text-muted-foreground">Saves your email on this device.</p>
                </div>
              </div>
            )}
          />

          <Button
            type="submit"
            disabled={busy}
            className="h-12 w-full rounded-xl text-sm font-semibold focus-visible:ring-2"
          >
            {busy ? (
              <>
                <Loader2 aria-hidden="true" className="motion-safe:animate-spin" />
                Signing in…
              </>
            ) : (
              <>Sign in <ArrowRight aria-hidden="true" /></>
            )}
          </Button>

      </form>
    </AuthCardShell>
  );
}
