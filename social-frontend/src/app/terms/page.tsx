import { redirect } from "next/navigation";
import { legalUrls } from "@/lib/brand";

/** Terms live on the marketing site — same URL as login/register links (new tab). */
export default function TermsRedirectPage() {
  redirect(legalUrls.terms);
}
