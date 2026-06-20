import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { HeroSection } from "@/components/public/HeroSection";
import { ResultsSection } from "@/components/public/ResultsSection";
import { HardwareExplainer } from "@/components/public/HardwareExplainer";
import { AISection } from "@/components/public/AISection";
import { MacGuidance } from "@/components/public/MacGuidance";
import { TrustSection } from "@/components/public/TrustSection";
import { WhatsAppCTA } from "@/components/public/WhatsAppCTA";
import { VisitCounter } from "@/components/public/VisitCounter";
import { Disclaimer } from "@/components/public/Disclaimer";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SiteHeader } from "@/components/public/SiteHeader";
import { ChatWidgetLoader } from "@/components/public/ChatWidgetLoader";
import type { Laptop } from "@/lib/types";

export const revalidate = 300;

export default async function HomePage() {
  const supabase = await createClient();

  const { data: laptopsRaw } = await supabase
    .from("laptops")
    .select("*")
    .eq("is_published", true)
    .order("priority_score", { ascending: false });

  const { data: settings } = await supabase
    .from("settings")
    .select("key, value");

  const settingsMap = Object.fromEntries(
    (settings ?? []).map((s: { key: string; value: string }) => [s.key, s.value])
  );

  const laptops: Laptop[] = (laptopsRaw ?? []) as Laptop[];

  return (
    <main className="min-h-screen">
      <SiteHeader className="fixed top-4 left-4 z-50" />
      <Link
        href="/blog"
        className="fixed top-4 right-16 z-50 inline-flex h-9 items-center rounded-xl glass-card border px-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors shadow-sm"
      >
        Blog
      </Link>
      <ThemeToggle />
      <HeroSection />
      <ResultsSection laptops={laptops} />
      <HardwareExplainer />
      <AISection />
      <MacGuidance />
      <TrustSection />
      <WhatsAppCTA whatsappUrl={settingsMap["whatsapp_url"]} />
      <VisitCounter />
      <Disclaimer text={settingsMap["disclaimer_text"]} />
      <WhatsAppCTA whatsappUrl={settingsMap["whatsapp_url"]} variant="floating" />
      <ChatWidgetLoader laptops={laptops} voiceEnabled={settingsMap["voice_input_enabled"] !== "false"} />
    </main>
  );
}
