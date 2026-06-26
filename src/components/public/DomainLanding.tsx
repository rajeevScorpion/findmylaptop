import Link from "next/link";
import { getDomainFlags } from "@/lib/flags";
import { getTaxonomy } from "@/lib/taxonomy";
import { getPublishedLaptopsForDomain, getPublicSettings } from "@/lib/laptop-queries";
import { DOMAIN_ORDER, type DomainConfig, type DomainId } from "@/lib/domains";
import { HeroSection } from "@/components/public/HeroSection";
import { ResultsSection } from "@/components/public/ResultsSection";
import { DomainTabs } from "@/components/public/DomainTabs";
import { AISection } from "@/components/public/AISection";
import { AdvisorySection } from "@/components/public/AdvisorySection";
import { TrustSection } from "@/components/public/TrustSection";
import { WhatsAppCTA } from "@/components/public/WhatsAppCTA";
import { VisitCounter } from "@/components/public/VisitCounter";
import { Disclaimer } from "@/components/public/Disclaimer";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SiteHeader } from "@/components/public/SiteHeader";
import { ChatWidgetLoader } from "@/components/public/ChatWidgetLoader";
// Shared, config-driven landing page rendered by /, /technology and /management.
// The active domain controls the laptop pool, taxonomy, hero copy, and theme
// (via the data-domain attribute, see globals.css).
export async function DomainLanding({ domain }: { domain: DomainConfig }) {
  const [laptops, settingsMap, taxonomy, flags] = await Promise.all([
    getPublishedLaptopsForDomain(domain.id),
    getPublicSettings(),
    getTaxonomy(domain.id),
    getDomainFlags(),
  ]);

  // Design is always enabled; the other two follow their flags.
  const enabledIds: DomainId[] = DOMAIN_ORDER.filter(
    (d) => !d.flagKey || flags[d.flagKey]
  ).map((d) => d.id);

  return (
    <main data-domain={domain.id} className="min-h-screen">
      <SiteHeader className="fixed top-4 left-4 z-50" />
      <Link
        href="/blog"
        className="fixed top-4 right-16 z-50 inline-flex h-9 items-center rounded-xl glass-card border px-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors shadow-sm"
      >
        Blog
      </Link>
      <ThemeToggle />
      <HeroSection
        badge={domain.hero.badge}
        titleLead={domain.hero.titleLead}
        titleAccent={domain.hero.titleAccent}
        subtitle={domain.hero.subtitle}
      />
      <DomainTabs activeId={domain.id} enabledIds={enabledIds} />
      <ResultsSection
        laptops={laptops}
        taxonomy={taxonomy}
        workloadTags={domain.workloadTags}
        finderSubtitle={domain.finder.subtitle}
        finderNote={domain.finder.note}
      />
      <AISection landscape={domain.landscape} />
      <AdvisorySection advisory={domain.advisory} />
      <TrustSection faqs={domain.faqs} />
      <WhatsAppCTA whatsappUrl={settingsMap["whatsapp_url"]} />
      <VisitCounter />
      <Disclaimer text={settingsMap["disclaimer_text"]} />
      <WhatsAppCTA whatsappUrl={settingsMap["whatsapp_url"]} variant="floating" />
      <ChatWidgetLoader
        laptops={laptops}
        voiceEnabled={settingsMap["voice_input_enabled"] !== "false"}
        domain={domain.id}
      />
    </main>
  );
}
