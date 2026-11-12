import { redirect } from "next/navigation";
import { legalMeta } from "@/content/legal";

/** Profound-style alias; canonical path is /terms (used by app auth links). */
export default function TermsOfServiceAliasPage() {
  redirect(legalMeta.termsPath);
}