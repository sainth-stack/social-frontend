import type { Metadata } from "next";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";

import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign in · OpsBrain AI",
  description: "Sign in to your OpsBrain AI Social Media Manager workspace",
};

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
