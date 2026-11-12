import type { Metadata } from "next";
import { LegalDocumentView } from "@/components/legal/LegalDocument";
import { legalMeta, termsDocument } from "@/content/legal";
import { brand } from "@/content/site";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `Terms governing use of ${brand.name}.`,
  alternates: { canonical: legalMeta.termsPath },
  openGraph: {
    title: `Terms of Service · ${brand.name}`,
    description: `Terms governing use of ${brand.name}.`,
    url: legalMeta.termsPath,
  },
};

export default function TermsPage() {
  return <LegalDocumentView document={termsDocument} />;
}
