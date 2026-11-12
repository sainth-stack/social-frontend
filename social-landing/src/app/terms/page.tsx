import { permanentRedirect } from "next/navigation";
import { TERMS_URL } from "@/content/site";

/** Canonical terms live on the product app (peers.opsbrainai.com). */
export default function TermsRedirectPage() {
  permanentRedirect(TERMS_URL);
}
