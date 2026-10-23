import type { Metadata } from "next";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";

import RegisterForm from "./RegisterForm";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create your EarnedVoice Social Media Manager workspace",
};

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-background" role="status" aria-label="Loading registration">
          <Loader2 className="size-7 animate-spin text-primary" aria-hidden="true" />
        </main>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
