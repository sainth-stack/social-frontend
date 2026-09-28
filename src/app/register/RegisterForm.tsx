"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import SparkAuthLayout from "@/components/auth/SparkAuthLayout";
import { Button } from "@/components/ui/button";
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
import { register as registerUser } from "@/features/auth/authThunks";
import { getHomeRoute } from "@/lib/auth/users";
// Google SSO disabled for now — re-enable with GoogleButton, OrDivider, startGoogleAuth
import { useAppDispatch, useAppSelector } from "@/store/hooks";

const schema = z
  .object({
    name: z.string().min(2, "Enter your full name"),
    business: z.string().min(2, "Enter your business name"),
    email: z.string().email("Enter a valid email"),
    password: z
      .string()
      .min(8, "At least 8 characters")
      .regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, "Include at least 1 letter and 1 number"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    path: ["confirm"],
    message: "Passwords do not match",
  });

export default function RegisterForm() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const authError = useAppSelector(selectAuthError);
  const authLoading = useAppSelector(selectAuthLoading);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isHydrated = useAppSelector(selectIsAuthHydrated);
  const user = useAppSelector(selectUser);

  const [form, setForm] = useState({
    name: "",
    business: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isHydrated || !isAuthenticated || !user) return;
    if (user.isPlatformAdmin) {
      router.replace(getHomeRoute(user));
      return;
    }
    router.replace("/dashboard/onboarding");
  }, [isAuthenticated, isHydrated, router, user]);

  function update<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        fe[String(issue.path[0])] = issue.message;
      });
      setErrors(fe);
      return;
    }
    setErrors({});
    dispatch(clearAuthError());

    try {
      await dispatch(
        registerUser({
          name: parsed.data.name,
          workspaceName: parsed.data.business,
          email: parsed.data.email,
          password: parsed.data.password,
        }),
      ).unwrap();
      toast.success("Workspace created");
      router.replace("/dashboard/onboarding");
    } catch {
      // Error stored in auth slice
    }
  }

  return (
    <SparkAuthLayout
      title="Create your workspace"
      subtitle="Start free — connect an account and start posting in minutes."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
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

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="Ava Chen"
              autoComplete="name"
              autoFocus
            />
            {errors.name ? <p className="text-xs text-destructive">{errors.name}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="business">Business name</Label>
            <Input
              id="business"
              value={form.business}
              onChange={(e) => update("business", e.target.value)}
              placeholder="Northstar Media"
              autoComplete="organization"
            />
            {errors.business ? (
              <p className="text-xs text-destructive">{errors.business}</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Work email</Label>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
          />
          {errors.email ? <p className="text-xs text-destructive">{errors.email}</p> : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={show ? "text" : "password"}
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              className="pr-10"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              aria-label="Toggle password"
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password ? (
            <p className="text-xs text-destructive">{errors.password}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input
            id="confirm"
            type={show ? "text" : "password"}
            value={form.confirm}
            onChange={(e) => update("confirm", e.target.value)}
            autoComplete="new-password"
          />
          {errors.confirm ? (
            <p className="text-xs text-destructive">{errors.confirm}</p>
          ) : null}
        </div>

        <Button type="submit" className="w-full" disabled={authLoading}>
          {authLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating…
            </>
          ) : (
            "Create account"
          )}
        </Button>

        {/* Google SSO disabled for now
        <OrDivider />
        <GoogleButton onClick={() => void startGoogleAuth()} />
        */}

        <p className="text-center text-xs text-muted-foreground">
          By creating an account, you agree to our Terms and Privacy Policy.
        </p>
      </form>
    </SparkAuthLayout>
  );
}
