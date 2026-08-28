"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { authApi } from "@/api/endpoints/auth.api";
import { loginSuccess } from "@/features/auth/authSlice";
import { mapMeResponseToUser } from "@/lib/auth/mapUser";
import { getHomeRoute } from "@/lib/auth/users";
import { useAppDispatch } from "@/store/hooks";

function GoogleCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();

  useEffect(() => {
    const token = searchParams.get("token");
    const error = searchParams.get("error");

    if (error) {
      toast.error(decodeURIComponent(error));
      router.replace("/login");
      return;
    }

    if (!token) {
      toast.error("Google sign-in did not return a token");
      router.replace("/login");
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const me = await authApi.me(token);
        if (cancelled) return;
        const user = mapMeResponseToUser(me);
        dispatch(loginSuccess({ user, accessToken: token }));
        router.replace(getHomeRoute(user));
      } catch {
        if (cancelled) return;
        toast.error("Could not complete Google sign-in");
        router.replace("/login");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dispatch, router, searchParams]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p>Completing Google sign-in…</p>
    </div>
  );
}

export default function GoogleCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <GoogleCallbackInner />
    </Suspense>
  );
}
