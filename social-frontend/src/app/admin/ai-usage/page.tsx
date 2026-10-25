import { Suspense } from "react";
import AdminAIUsage from "@/components/admin/AdminAIUsage";

export default function AdminAIUsagePage() {
  return <Suspense fallback={<p role="status">Loading AI usage…</p>}><AdminAIUsage /></Suspense>;
}