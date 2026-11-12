import { permanentRedirect } from "next/navigation";
import { TERMS_URL } from "@/content/site";

export default function TermsOfServiceAliasPage() {
  permanentRedirect(TERMS_URL);
}
