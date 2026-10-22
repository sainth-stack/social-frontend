"use client";

import { useEffect, useRef, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import AuthCardShell from "@/components/auth/AuthCardShell";
import { AuthFormField, AuthPasswordStrength } from "@/components/auth/AuthFormFields";
import { Button } from "@/components/ui/button";
import {
  clearAuthError,
  selectAuthError,
  selectAuthLoading,
  selectIsAuthenticated,
  selectIsAuthHydrated,
  selectUser,
} from "@/features/auth/authSlice";
import { register as registerUser } from "@/features/auth/authThunks";
import { platformBrand } from "@/lib/brand";
import { getHomeRoute } from "@/lib/auth/users";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

const registerSchema = z
  .object({
    name: z.string().min(2, "Enter your full name"),
    business: z.string().min(2, "Enter your business or workspace name"),
    email: z.string().min(1, "Email is required").email("Enter a valid email"),
    password: z
      .string()
      .min(8, "At least 8 characters")
      .regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, "Include at least one letter and one number"),
    confirm: z.string().min(1, "Confirm your password"),
  })
  .refine((data) => data.password === data.confirm, {
    path: ["confirm"],
    message: "Passwords do not match",
  });

type RegisterValues = z.infer<typeof registerSchema>;

export default function RegisterForm() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const authError = useAppSelector(selectAuthError);
  const authLoading = useAppSelector(selectAuthLoading);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isHydrated = useAppSelector(selectIsAuthHydrated);
  const user = useAppSelector(selectUser);
  const submitting = useRef(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      business: "",
      email: "",
      password: "",
      confirm: "",
    },
    mode: "onSubmit",
  });

  const passwordValue = watch("password");

  useEffect(() => {
    dispatch(clearAuthError());
  }, [dispatch]);

  useEffect(() => {
    if (!isHydrated || !isAuthenticated || !user) return;
    if (user.isPlatformAdmin) {
      router.replace(getHomeRoute(user));
      return;
    }
    router.replace("/dashboard/onboarding");
  }, [isAuthenticated, isHydrated, router, user]);

  const busy = isSubmitting || authLoading;
  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current || busy) return;
    submitting.current = true;
    try {
      await handleSubmit(async (values) => {
        dispatch(clearAuthError());
        try {
          await dispatch(
            registerUser({
              name: values.name,
              workspaceName: values.business,
              email: values.email,
              password: values.password,
            }),
          ).unwrap();
          toast.success("Workspace created — welcome to OpsBrain");
          router.replace("/dashboard/onboarding");
        } catch {}
      })(event);
    } finally {
      submitting.current = false;
    }
  };

  const termsUrl = `${platformBrand.marketingUrl}/terms`;
  const privacyUrl = `${platformBrand.marketingUrl}/privacy`;

  return (
    <AuthCardShell
      title="Create your workspace"
      subtitle="Bring your channels, content, and team together in one workspace."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="rounded-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Sign in
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

          <div className="grid gap-5 sm:grid-cols-2">
              <AuthFormField
                label="Full name"
                autoComplete="name"
                autoFocus
                placeholder="Ava Chen"
                error={errors.name?.message}
                disabled={busy}
                {...register("name")}
              />
              <AuthFormField
                label="Business name"
                autoComplete="organization"
                placeholder="Northstar Media"
                error={errors.business?.message}
                disabled={busy}
                {...register("business")}
              />
          </div>

          <AuthFormField
            label="Work email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            error={errors.email?.message}
            disabled={busy}
            {...register("email")}
          />

          <div>
            <AuthFormField
              label="Password"
              password
              autoComplete="new-password"
              placeholder="At least 8 characters"
              error={errors.password?.message}
              hint="Use at least 8 characters, including a letter and a number."
              disabled={busy}
              {...register("password")}
            />
            <AuthPasswordStrength password={passwordValue} />
          </div>

          <AuthFormField
            label="Confirm password"
            password
            autoComplete="new-password"
            placeholder="Re-enter your password"
            error={errors.confirm?.message}
            disabled={busy}
            {...register("confirm")}
          />

          <Button
            type="submit"
            disabled={busy}
            className="h-12 w-full rounded-xl text-sm font-semibold focus-visible:ring-2"
          >
            {busy ? (
              <>
                <Loader2 aria-hidden="true" className="motion-safe:animate-spin" />
                Creating workspace…
              </>
            ) : (
              <>Create account <ArrowRight aria-hidden="true" /></>
            )}
          </Button>

          <p className="text-center text-xs leading-relaxed text-muted-foreground">
            By creating an account, you agree to our{" "}
            <Link href={termsUrl} target="_blank" rel="noopener noreferrer" className="rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Terms
            </Link>{" "}
            and{" "}
            <Link href={privacyUrl} target="_blank" rel="noopener noreferrer" className="rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Privacy Policy
            </Link>
            .
          </p>
      </form>
    </AuthCardShell>
  );
}
