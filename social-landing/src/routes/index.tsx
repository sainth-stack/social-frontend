import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { Hero } from "@/components/landing/Hero";
import { WeeklyPlannerDemo } from "@/components/landing/WeeklyPlannerDemo";
import { AnalyticsTeam, Audience, BrandVoice, Bridge, Calendar, ContentStudio, HowItWorks, PlatformGrid } from "@/components/landing/Sections";
import { FAQ, FinalCTA, Pricing, SiteFooter } from "@/components/landing/Closing";

const title = "OpsBrain AI — AI Social Media Planner & Content Studio";
const description = "Create on-brand captions, explore AI content ideas, and organize your next week of social posts with OpsBrain AI. Start with a free plan.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">Skip to content</a>
      <SiteHeader />
      <main id="main">
        <Hero />
        <PlatformGrid />
        <Bridge />
        <WeeklyPlannerDemo />
        <HowItWorks />
        <ContentStudio />
        <BrandVoice />
        <Calendar />
        <AnalyticsTeam />
        <Audience />
        <Pricing />
        <FAQ />
        <FinalCTA />
      </main>
      <SiteFooter />
    </>
  );
}
