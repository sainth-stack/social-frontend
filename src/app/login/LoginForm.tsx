"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import SparkAuthLayout, {
  GoogleButton,
  OrDivider,
} from "@/components/auth/SparkAuthLayout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
import { getHomeRoute } from "@/lib/auth/users";
import { startGoogleAuth } from "@/lib/auth/googleAuth";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

const REMEMBER_EMAIL_KEY = "opsbrain_remember_email";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();
  const authError = useAppSelector(selectAuthError);
  const authLoading = useAppSelector(selectAuthLoading);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isHydrated = useAppSelector(selectIsAuthHydrated);
  const user = useAppSelector(selectUser);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  useEffect(() => {
    const savedEmail = window.localStorage.getItem(REMEMBER_EMAIL_KEY);
    if (savedEmail) setEmail(savedEmail);
  }, []);

  useEffect(() => {
    if (!isHydrated || !isAuthenticated || !user) return;
    const redirect = searchParams.get("redirect");
    router.replace(redirect ?? getHomeRoute(user));
  }, [isAuthenticated, isHydrated, router, searchParams, user]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      const fieldErrors: typeof errors = {};
      parsed.error.issues.forEach((issue) => {
        const key = issue.path[0] as "email" | "password";
        fieldErrors[key] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    dispatch(clearAuthError());

    if (remember) {
      window.localStorage.setItem(REMEMBER_EMAIL_KEY, email);
    } else {
      window.localStorage.removeItem(REMEMBER_EMAIL_KEY);
    }

    try {
      const result = await dispatch(login(parsed.data)).unwrap();
      const redirect = searchParams.get("redirect");
      router.replace(redirect ?? getHomeRoute(result.user));
    } catch {
      // Error stored in auth slice
    }
  }

  return (
    <SparkAuthLayout
      title="Welcome back"
      subtitle="Sign in to manage your social media in minutes."
      footer={
        <>
          New to OpsBrain?{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        {authError ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {authError}
          </p>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!errors.email}
          />
          {errors.email ? <p className="text-xs text-destructive">{errors.email}</p> : null}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!errors.password}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              aria-label={show ? "Hide password" : "Show password"}
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password ? <p className="text-xs text-destructive">{errors.password}</p> : null}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={remember}
            onCheckedChange={(v) => setRemember(v === true)}
            id="remember"
          />
          <span>Remember me for 30 days</span>
        </label>

        <Button type="submit" className="w-full" disabled={authLoading}>
          {authLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </Button>

        <OrDivider />
        <GoogleButton onClick={() => void startGoogleAuth()} />
      </form>
    </SparkAuthLayout>
  );
}
