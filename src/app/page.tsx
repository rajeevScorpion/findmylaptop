import { createClient } from "@/lib/supabase/server";
import { HeroSection } from "@/components/public/HeroSection";
import { ResultsSection } from "@/components/public/ResultsSection";
import { HardwareExplainer } from "@/components/public/HardwareExplainer";
import { AISection } from "@/components/public/AISection";
import { MacGuidance } from "@/components/public/MacGuidance";
import { WhatsAppCTA } from "@/components/public/WhatsAppCTA";
import { Disclaimer } from "@/components/public/Disclaimer";
import { ThemeToggle } from "@/components/ThemeToggle";
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
      <ThemeToggle />
      <HeroSection />
      <ResultsSection laptops={laptops} />
      <HardwareExplainer />
      <AISection />
      <MacGuidance />
      <WhatsAppCTA whatsappUrl={settingsMap["whatsapp_url"]} />
      <Disclaimer text={settingsMap["disclaimer_text"]} />
      <WhatsAppCTA whatsappUrl={settingsMap["whatsapp_url"]} variant="floating" />
    </main>
  );
}
