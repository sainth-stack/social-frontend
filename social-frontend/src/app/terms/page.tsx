import type { Metadata } from "next";
import { LegalDocumentView } from "@/components/legal/LegalDocumentView";
import { termsDocument } from "@shared/content/legal";
import { platformBrand } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `Terms governing use of ${platformBrand.name}.`,
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return <LegalDocumentView document={termsDocument} />;
}
