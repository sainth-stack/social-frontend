import { redirect } from "next/navigation";
import { legalUrls } from "@/lib/brand";

/** Privacy lives on the marketing site — same URL as login/register links (new tab). */
export default function PrivacyRedirectPage() {
  redirect(legalUrls.privacy);
}
