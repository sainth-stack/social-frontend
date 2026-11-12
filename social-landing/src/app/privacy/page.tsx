import type { Metadata } from "next";
import { LegalDocumentView } from "@/components/legal/LegalDocument";
import { legalMeta, privacyDocument } from "@/content/legal";
import { brand } from "@/content/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${brand.name} collects, uses and protects personal data.`,
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: `Privacy Policy · ${brand.name}`,
    description: `How ${brand.name} collects, uses and protects personal data.`,
    url: legalMeta.privacyPath,
  },
};

export default function PrivacyPage() {
  return <LegalDocumentView document={privacyDocument} />;
}
