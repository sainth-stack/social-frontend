/**
 * Single source of truth for public legal pages.
 * Update copy, contacts, and “last updated” here — pages render from this module.
 * Have counsel review before launch; replace placeholder entity/address details when confirmed.
 */

import { APP_URL, MARKETING_URL, PRIVACY_URL, TERMS_URL } from "./public-urls";

export const legalMeta = {
  productName: "EarnedVoice",
  operatorName: "OpsBrain AI",
  /** Confirm registered entity name with counsel before launch. */
  legalEntityName: "OpsBrain AI",
  /** Confirm registered office with counsel before launch. */
  registeredOffice: "Bengaluru, Karnataka, India",
  supportEmail: "support@opsbrainai.com",
  legalEmail: "legal@opsbrainai.com",
  grievanceOfficer: {
    name: "Grievance Officer",
    email: "legal@opsbrainai.com",
    responseTime: "Within thirty (30) days",
  },
  governingLaw: "India",
  jurisdiction: "courts at Bengaluru, Karnataka",
  siteUrl: MARKETING_URL,
  appUrl: APP_URL,
  privacyPath: "/privacy",
  termsPath: "/terms",
  privacyLastUpdated: "12 November 2026",
  termsEffectiveDate: "12 November 2026",
} as const;

/** Privacy and terms on the marketing site (earnedvoice). */
export const legalLinks = [
  { label: "Privacy Policy", href: PRIVACY_URL },
  { label: "Terms of Service", href: TERMS_URL },
] as const;

export type LegalBlock =
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "subheading"; text: string };

export type LegalSection = {
  id: string;
  title: string;
  blocks: LegalBlock[];
};

export type LegalDocument = {
  slug: "privacy" | "terms";
  title: string;
  eyebrow: string;
  updatedLabel: string;
  updatedValue: string;
  operatorLine: string;
  intro: string;
  sections: LegalSection[];
};

const { productName, operatorName, legalEntityName, registeredOffice, supportEmail, legalEmail, grievanceOfficer, siteUrl, appUrl } = legalMeta;

export const privacyDocument: LegalDocument = {
  slug: "privacy",
  title: "Privacy Policy",
  eyebrow: "Legal",
  updatedLabel: "Last updated",
  updatedValue: legalMeta.privacyLastUpdated,
  operatorLine: `Operated by ${legalEntityName} · ${registeredOffice} · Contact: ${supportEmail}`,
  intro: `This Privacy Policy explains how ${legalEntityName} (“${operatorName}”, “we”, “us”) collects, uses, shares and protects personal data when you use ${productName} at ${siteUrl}, the application at ${appUrl}, and related services (the “Platform”). For personal data covered by India’s Digital Personal Data Protection Act, 2023 (“DPDP Act”) we act as a Data Fiduciary and, where the EU or UK GDPR applies, as a controller.`,
  sections: [
    {
      id: "who",
      title: "1. Who We Are And Who This Policy Covers",
      blocks: [
        {
          type: "p",
          text: `This Policy covers people who browse the marketing site, create a ${productName} account, connect social accounts, generate or publish content, invite teammates, or contact us. Organisations that use ${productName} as a workspace are responsible for ensuring their members’ use complies with this Policy and applicable law.`,
        },
        {
          type: "ol",
          items: [
            "Account holders and workspace members who plan, draft, schedule or publish social content.",
            "Administrators who manage billing, seats, brand settings and connected integrations.",
            "Visitors who browse the marketing site or submit a contact enquiry.",
          ],
        },
      ],
    },
    {
      id: "collect",
      title: "2. Information We May Collect",
      blocks: [
        {
          type: "ol",
          items: [
            "Account and profile data: name, email, password (hashed), business or workspace name, role and preferences.",
            "Content and brand inputs: briefs, brand voice settings, drafts, media you upload, captions, schedules and approval comments.",
            "Connected platform data: tokens and metadata needed to publish or read analytics from integrations you authorise (for example Instagram, Facebook or LinkedIn), subject to those platforms’ terms.",
            "Usage and device data: pages viewed, feature use, approximate location derived from IP, browser and device information, and diagnostic logs.",
            "Billing data: plan, invoices and payment status handled by our payment processors; we do not store full card numbers.",
            "Communications: messages you send to support or sales, and related tickets.",
          ],
        },
      ],
    },
    {
      id: "use",
      title: "3. Why We Use Your Information",
      blocks: [
        {
          type: "p",
          text: `We use personal data to create and secure accounts, deliver planning and drafting features, connect publishing integrations, show usage against plan allowances, process payments, provide support, prevent abuse, and meet legal obligations.`,
        },
        {
          type: "p",
          text: "If you are in India: we process on the basis of your consent (given by clear affirmative action — continued browsing alone is not consent) or on legitimate uses permitted by the DPDP Act, including where processing is necessary to provide a service you requested.",
        },
        {
          type: "p",
          text: "If you are in the EEA or UK: legal grounds may include contract (running your account), consent (non-essential cookies or optional AI training where offered), legitimate interests (securing and improving the Platform, balanced against your rights), and legal obligation.",
        },
      ],
    },
    {
      id: "ai",
      title: "4. AI Features And Content",
      blocks: [
        {
          type: "p",
          text: `${productName} uses artificial intelligence to suggest ideas, drafts, images and plans. AI outputs can be inaccurate or incomplete. You remain responsible for reviewing content before publishing and for not submitting confidential client or personal data you are not authorised to process.`,
        },
        {
          type: "p",
          text: "Where we use prompts, drafts or related inputs to improve models or quality, we do so under applicable law and, where required, your consent. You may withdraw consent for optional improvement uses by contacting us; withdrawal applies going forward and may not reverse improvements already made where reversal is not technically feasible. We do not sell your personal data.",
        },
      ],
    },
    {
      id: "share",
      title: "5. Who We Share Data With",
      blocks: [
        {
          type: "p",
          text: "We share personal data with processors acting on our written instructions (hosting, email, analytics, AI providers, payment processors and social platforms you connect). We may disclose data to authorities when the law requires, or to a successor in a merger or asset sale on equivalent protections with notice where required. We do not sell, rent or trade personal data.",
        },
      ],
    },
    {
      id: "transfers",
      title: "6. Where Your Data Goes",
      blocks: [
        {
          type: "p",
          text: `We operate from India and may use processors in other countries. Transfers outside India follow applicable DPDP rules. Where GDPR applies, international transfers use an adequacy decision or Standard Contractual Clauses (or equivalent) with supplementary measures where needed. You can request information about safeguards via ${legalEmail}.`,
        },
      ],
    },
    {
      id: "security",
      title: "7. Security And Breaches",
      blocks: [
        {
          type: "p",
          text: "We maintain reasonable technical and organisational safeguards, including encryption in transit, access controls, monitoring and contractual security obligations on processors. No system is perfectly secure. If a personal data breach occurs we will investigate, contain it, and notify regulators and affected individuals as required by applicable law (including DPDP Rules and, where relevant, GDPR).",
        },
      ],
    },
    {
      id: "retention",
      title: "8. How Long We Keep It",
      blocks: [
        {
          type: "p",
          text: "We keep personal data only as long as needed to provide the Platform, comply with law, resolve disputes and enforce agreements. After account closure we delete or anonymise personal data within a reasonable period, except where retention is required for legal, security or billing reasons. You may request erasure by contacting us; we acknowledge requests promptly and complete them within timelines required by applicable law unless a lawful retention ground applies.",
        },
      ],
    },
    {
      id: "rights",
      title: "9. Your Rights",
      blocks: [
        {
          type: "subheading",
          text: "9.1 India (DPDP Act)",
        },
        {
          type: "p",
          text: "You may seek confirmation and a summary of personal data we process, correction, completion, updating or erasure, withdraw consent, nominate another person to exercise rights in case of death or incapacity, and raise a grievance under Clause 10.",
        },
        {
          type: "subheading",
          text: "9.2 EEA / UK (GDPR)",
        },
        {
          type: "p",
          text: "You may access, rectify, erase, restrict, port your data, object to processing based on legitimate interests, and withdraw consent without affecting prior lawful processing.",
        },
        {
          type: "subheading",
          text: "9.3 United States",
        },
        {
          type: "p",
          text: "Depending on your state, you may have rights to know, access, correct, delete or opt out of certain sharing. We honour verified requests as those laws require.",
        },
      ],
    },
    {
      id: "grievance",
      title: "10. Grievance Officer And Contacts",
      blocks: [
        {
          type: "p",
          text: "Under applicable Indian law, you may contact our Grievance Officer:",
        },
        {
          type: "table",
          headers: ["Designation", "Details"],
          rows: [
            ["Grievance Officer", grievanceOfficer.name],
            ["Email", grievanceOfficer.email],
            ["Response Time", grievanceOfficer.responseTime],
          ],
        },
        {
          type: "p",
          text: `General questions: ${supportEmail}. Privacy or rights requests: ${legalEmail}.`,
        },
      ],
    },
    {
      id: "cookies",
      title: "11. Cookies And Tracking",
      blocks: [
        {
          type: "p",
          text: "We use cookies and similar technologies needed to run the site and app, and limited analytics. Marketing analytics on the landing site are designed to avoid unnecessary identifiers and respect Do Not Track / Global Privacy Control where implemented. You can control cookies through your browser; blocking some cookies may limit functionality.",
        },
      ],
    },
    {
      id: "minors",
      title: "12. Minors",
      blocks: [
        {
          type: "p",
          text: "The Platform is for adults running or supporting a business. We do not knowingly collect personal data from anyone under eighteen (18). If we learn we have such data, we will delete it promptly.",
        },
      ],
    },
    {
      id: "changes",
      title: "13. Changes, Governing Law And Contact",
      blocks: [
        {
          type: "p",
          text: `We may update this Policy and publish the revised version here with a new “Last updated” date. Material changes that expand processing in a meaningful way will be notified by email or in-product notice where required, and we will obtain fresh consent where the law requires it.`,
        },
        {
          type: "p",
          text: `This Policy is governed by the laws of ${legalMeta.governingLaw}. Disputes are subject to the exclusive jurisdiction of the ${legalMeta.jurisdiction}, without limiting mandatory rights you may have under GDPR or other applicable law.`,
        },
        {
          type: "p",
          text: `Questions: ${supportEmail} or ${legalEmail}.`,
        },
      ],
    },
  ],
};

export const termsDocument: LegalDocument = {
  slug: "terms",
  title: "Terms of Service",
  eyebrow: "Legal",
  updatedLabel: "Effective date",
  updatedValue: legalMeta.termsEffectiveDate,
  operatorLine: `Operated by ${legalEntityName} · ${registeredOffice} · Contact: ${supportEmail}`,
  intro: `These Terms of Service (the “Terms”) govern your access to and use of ${productName}, including the website at ${siteUrl}, the application at ${appUrl}, and related AI-assisted planning, drafting and publishing tools (collectively, the “Platform”), operated by ${legalEntityName} (“${operatorName}”, “we”, “us”). By creating an account, accessing or using the Platform, you agree to these Terms. If you do not agree, do not use the Platform.`,
  sections: [
    {
      id: "definitions",
      title: "1. Definitions",
      blocks: [
        {
          type: "ul",
          items: [
            `“User” means any individual or entity that accesses or uses the Platform.`,
            `“Workspace” means an organisation account on ${productName} and its members, content and settings.`,
            `“User Content” means briefs, brand settings, drafts, media, captions, comments and other material you submit or generate through the Platform.`,
            `“Integrations” means third-party social or other services you connect to publish or retrieve data.`,
            `Capitalised terms not defined here have the meaning given in the Privacy Policy.`,
          ],
        },
      ],
    },
    {
      id: "eligibility",
      title: "2. Eligibility And Accounts",
      blocks: [
        {
          type: "p",
          text: "You must be at least 18 years of age and able to form a binding contract. If you accept these Terms for an organisation, you represent that you are authorised to bind that organisation. Provide accurate information and keep credentials secure. You are responsible for activity under your account. Notify us promptly of unauthorised use. We may suspend or terminate accounts that violate these Terms or present a security, legal or reputational risk.",
        },
      ],
    },
    {
      id: "service",
      title: "3. The Platform And AI Features",
      blocks: [
        {
          type: "subheading",
          text: "3.1 Nature of the service",
        },
        {
          type: "p",
          text: `${productName} helps you plan, draft, schedule and publish social content and review performance. AI-generated ideas, captions, images and plans are assistive only and may contain errors. They are not legal, professional or marketing advice. Generating a plan does not publish it; you choose what to schedule or publish.`,
        },
        {
          type: "subheading",
          text: "3.2 Your responsibility for published content",
        },
        {
          type: "p",
          text: "You are solely responsible for reviewing User Content before publishing, including facts, claims, permissions, trademarks, confidential information and platform-specific rules. We do not provide automated fact-checking or confidentiality screening.",
        },
        {
          type: "subheading",
          text: "3.3 Integrations",
        },
        {
          type: "p",
          text: "Connecting an Integration authorises us to act on your behalf as needed to publish, schedule or retrieve analytics within the scopes you grant. Third-party platform terms also apply. We are not responsible for those platforms’ availability, policy changes or enforcement actions.",
        },
      ],
    },
    {
      id: "acceptable-use",
      title: "4. Acceptable Use",
      blocks: [
        {
          type: "p",
          text: "You agree not to:",
        },
        {
          type: "ul",
          items: [
            "use the Platform for unlawful, fraudulent, discriminatory or harmful purposes;",
            "misrepresent identity, affiliation or authority;",
            "upload content that is defamatory, infringing, deceptive or that violates others’ rights;",
            "attempt to reverse-engineer, scrape or extract data except as expressly permitted;",
            "circumvent security, billing or usage limits;",
            "use the Platform to build a competing product by improperly extracting proprietary materials; or",
            "introduce malware or disrupt the Platform.",
          ],
        },
      ],
    },
    {
      id: "ai-training",
      title: "5. AI Improvement",
      blocks: [
        {
          type: "p",
          text: "You acknowledge that User Content and related telemetry may be used to operate, evaluate and improve the Platform and, where permitted by law and our Privacy Policy, to improve AI systems. Where practicable, improvement data is anonymised, pseudonymised or aggregated. You grant us a non-exclusive, worldwide, royalty-free licence to use User Content as needed to provide and improve the Platform for the duration described in our Privacy Policy.",
        },
      ],
    },
    {
      id: "processors",
      title: "6. Sub-Processors",
      blocks: [
        {
          type: "p",
          text: "We engage trusted processors under contractual safeguards. Categories may include cloud hosting, email delivery, analytics, AI model providers, payment processors and social platform APIs. We may update processors over time; continued use after notice of material changes constitutes acceptance where permitted by law.",
        },
      ],
    },
    {
      id: "privacy",
      title: "7. Data Protection And Privacy",
      blocks: [
        {
          type: "p",
          text: `Personal data is processed as described in our Privacy Policy, which forms part of these Terms. Retention, security, international transfers and your rights are set out there. Contact ${legalEmail} for privacy requests.`,
        },
      ],
    },
    {
      id: "plans",
      title: "8. Plans, Allowances And Billing",
      blocks: [
        {
          type: "p",
          text: "Plan features, monthly allowances (posts, AI text, images) and prices are described on the pricing page and in-product. Free plans may have limits. Paid plans renew monthly unless cancelled. Taxes may apply. Custom Scale plans are sold through sales. Failure to pay may result in suspension. Allowances reset per your billing cycle and unused amounts do not roll over unless we expressly say so.",
        },
      ],
    },
    {
      id: "ip",
      title: "9. Intellectual Property",
      blocks: [
        {
          type: "p",
          text: `The Platform (software, design, trademarks and non-User Content) is owned by ${legalEntityName} or its licensors. We grant you a limited, non-exclusive, non-transferable, revocable licence to use the Platform per these Terms. You retain ownership of User Content and grant us the licences needed to host, process, display and publish it as you direct, and to improve the Platform as described above.`,
        },
      ],
    },
    {
      id: "confidentiality",
      title: "10. Confidentiality",
      blocks: [
        {
          type: "p",
          text: "You may access non-public business, product or technical information. Keep it confidential and use it only for legitimate Platform purposes. Do not submit third-party confidential information without authority.",
        },
      ],
    },
    {
      id: "disclaimers",
      title: "11. Disclaimers",
      blocks: [
        {
          type: "p",
          text: `The Platform and all AI outputs are provided “as is” and “as available” without warranties of any kind, including merchantability, fitness for a particular purpose, accuracy or non-infringement. We do not warrant uninterrupted service, specific reach, engagement, leads or business outcomes.`,
        },
      ],
    },
    {
      id: "liability",
      title: "12. Limitation Of Liability",
      blocks: [
        {
          type: "p",
          text: `To the maximum extent permitted by law, ${legalEntityName} and its directors, employees and processors shall not be liable for indirect, incidental, special, consequential or punitive damages, or for loss of profits, data, goodwill or business. Aggregate liability arising from these Terms shall not exceed the amounts you paid to us in the twelve (12) months preceding the claim, or INR 10,000, whichever is higher.`,
        },
      ],
    },
    {
      id: "indemnity",
      title: "13. Indemnity",
      blocks: [
        {
          type: "p",
          text: `You agree to indemnify and hold harmless ${legalEntityName} and its affiliates from claims, damages and expenses (including reasonable legal fees) arising from your breach of these Terms, your User Content, your use of Integrations, or your violation of law or third-party rights.`,
        },
      ],
    },
    {
      id: "termination",
      title: "14. Suspension And Termination",
      blocks: [
        {
          type: "p",
          text: "We may suspend or terminate access where you breach these Terms, present a security or legal risk, or as required by law. You may stop using the Platform and request account deletion at any time. Data handling after closure follows the Privacy Policy. Provisions that by nature should survive (including IP, disclaimers, liability, indemnity and governing law) survive termination.",
        },
      ],
    },
    {
      id: "changes",
      title: "15. Changes To These Terms",
      blocks: [
        {
          type: "p",
          text: "We may update these Terms from time to time. Material changes will be notified through the Platform or by email. Continued use after changes take effect constitutes acceptance. If you do not agree, stop using the Platform.",
        },
      ],
    },
    {
      id: "law",
      title: "16. Governing Law And Disputes",
      blocks: [
        {
          type: "p",
          text: `These Terms are governed by the laws of ${legalMeta.governingLaw}. Subject to applicable law, the ${legalMeta.jurisdiction} have exclusive jurisdiction over disputes, without prejudice to mandatory data-protection rights.`,
        },
      ],
    },
    {
      id: "contact",
      title: "17. Contact And Acceptance",
      blocks: [
        {
          type: "p",
          text: `Questions about these Terms: ${supportEmail}. By creating an account or using the Platform, you acknowledge that you have read and agree to these Terms of Service and the Privacy Policy.`,
        },
      ],
    },
  ],
};

export const legalDocuments = {
  privacy: privacyDocument,
  terms: termsDocument,
} as const;
