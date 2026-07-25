import type { Metadata } from "next";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";

import RegisterForm from "./RegisterForm";

export const metadata: Metadata = {
  title: "Create account · OpsBrain AI",
  description: "Create your OpsBrain AI Social Media Manager workspace",
};

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
