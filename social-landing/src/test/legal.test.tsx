import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LegalDocumentView } from "@/components/legal/LegalDocument";
import { privacyDocument, termsDocument } from "@/content/legal";

describe("legal documents", () => {
  it("renders privacy policy in numbered SaaS document format", () => {
    render(<LegalDocumentView document={privacyDocument} />);
    expect(screen.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeInTheDocument();
    expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Grievance Officer And Contacts/i })).toBeInTheDocument();
    const topNav = screen.getByRole("navigation", { name: "Legal documents" });
    expect(within(topNav).getByRole("link", { name: "Terms of Service" })).toHaveAttribute("href", "/terms");
  });

  it("renders terms of service with operator line and cross-link", () => {
    render(<LegalDocumentView document={termsDocument} />);
    expect(screen.getByRole("heading", { level: 1, name: "Terms of Service" })).toBeInTheDocument();
    expect(screen.getByText(/Effective date:/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /The Platform And AI Features/i })).toBeInTheDocument();
    const topNav = screen.getByRole("navigation", { name: "Legal documents" });
    expect(within(topNav).getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
  });
});
