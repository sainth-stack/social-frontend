import { SiteHeader } from "@/components/landing/SiteHeader";
import { Hero } from "@/components/landing/Hero";
import { WeeklyPlannerDemo } from "@/components/landing/WeeklyPlannerDemo";
import { PlatformGrid } from "@/components/landing/Sections";
import { AnalyticsFeature, BrandFeature, CreationFeature, ProductJourney, PublishingFeature, ReviewFeature } from "@/components/landing/ExperienceSections";
import { FAQ, FinalCTA, Pricing, SiteFooter } from "@/components/landing/Closing";
import { brand, SITE_URL, seo } from "@/content/site";
import { ContactForm } from "@/components/landing/ContactForm";
import { MarketingAnalytics } from "@/components/landing/MarketingAnalytics";

export default function HomePage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: brand.name, url: SITE_URL, logo: `${SITE_URL}/brand/earnedvoice-lockup.svg` },
      { "@type": "WebSite", "@id": `${SITE_URL}/#website`, name: brand.name, url: SITE_URL, publisher: { "@id": `${SITE_URL}/#organization` }, inLanguage: "en" },
      { "@type": "SoftwareApplication", name: brand.name, applicationCategory: "BusinessApplication", operatingSystem: "Web", url: SITE_URL, description: seo.description, publisher: { "@id": `${SITE_URL}/#organization` } },
    ],
  };

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
    <a href="#main" className="skip-link">Skip to content</a>
    <MarketingAnalytics />
    <SiteHeader />
    <main id="main" tabIndex={-1}>
      <Hero /><PlatformGrid /><ProductJourney />
      <CreationFeature /><PublishingFeature /><WeeklyPlannerDemo />
      <BrandFeature /><AnalyticsFeature /><ReviewFeature />
      <Pricing /><FAQ /><ContactForm /><FinalCTA />
    </main>
    <SiteFooter />
  </>;
}