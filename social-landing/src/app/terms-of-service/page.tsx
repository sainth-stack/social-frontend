import { permanentRedirect } from "next/navigation";
import { legalMeta } from "@/content/legal";

export default function TermsOfServiceAliasPage() {
  permanentRedirect(legalMeta.termsPath);
}
