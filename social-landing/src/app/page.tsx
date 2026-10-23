import { SiteHeader } from "@/components/landing/SiteHeader";
import { Hero } from "@/components/landing/Hero";
import { WeeklyPlannerDemo } from "@/components/landing/WeeklyPlannerDemo";
import { AnalyticsTeam, Audience, BrandVoice, Bridge, Calendar, ContentStudio, HowItWorks, PlatformGrid } from "@/components/landing/Sections";
import { FAQ, FinalCTA, Pricing, SiteFooter } from "@/components/landing/Closing";
import { SITE_URL, seo } from "@/content/site";

export default function HomePage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: "OpsBrain AI", url: SITE_URL, logo: `${SITE_URL}/brand/mark.png` },
      { "@type": "WebSite", "@id": `${SITE_URL}/#website`, name: "OpsBrain AI", url: SITE_URL, publisher: { "@id": `${SITE_URL}/#organization` }, inLanguage: "en" },
      { "@type": "SoftwareApplication", name: "OpsBrain AI", applicationCategory: "BusinessApplication", operatingSystem: "Web", url: SITE_URL, description: seo.description, publisher: { "@id": `${SITE_URL}/#organization` } },
    ],
  };

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
    <a href="#main" className="skip-link">Skip to content</a>
    <SiteHeader />
    <main id="main" tabIndex={-1}>
      <Hero /><PlatformGrid /><Bridge /><HowItWorks /><WeeklyPlannerDemo />
      <ContentStudio /><BrandVoice /><Calendar /><AnalyticsTeam /><Audience />
      <Pricing /><FAQ /><FinalCTA />
    </main>
    <SiteFooter />
  </>;
}