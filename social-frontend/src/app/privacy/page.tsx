import { permanentRedirect } from "next/navigation";
import { legalUrls } from "@/lib/brand";

/** Canonical privacy policy is on the marketing site (earnedvoice.opsbrainai.com). */
export default function PrivacyRedirectPage() {
  permanentRedirect(legalUrls.privacy);
}
