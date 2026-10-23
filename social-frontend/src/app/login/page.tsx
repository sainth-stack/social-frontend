import type { Metadata } from "next";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";

import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your EarnedVoice Social Media Manager workspace",
};

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-background" role="status" aria-label="Loading sign in">
          <Loader2 className="size-7 animate-spin text-primary" aria-hidden="true" />
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
