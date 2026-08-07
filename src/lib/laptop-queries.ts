import { cacheLife, cacheTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Laptop } from "@/lib/types";
import type { HomePickCandidate } from "@/lib/home-picks";
import type { GrowthAgentDatabaseClient } from "@/lib/growth-agents/types";
import {
  buildAffiliateOutboundPath,
  type WithAffiliateCta,
} from "@/lib/affiliate/public";
import { getAffiliateCtaMetadataForLaptops } from "@/lib/affiliate/resolver";

// Deliberately excludes stored marketplace/affiliate destinations and other
// admin-only payloads. Public CTAs resolve from a laptop identifier on /api/out.
const PUBLIC_LAPTOP_SELECT =
  "id, slug, domain, name, brand, model, price_approx, image_url, cpu, gpu, gpu_vram_gb, ram, ram_gb, storage, storage_gb, display, weight, os, tier, workload_tags, recommended_for_courses, not_ideal_for, why_recommended, cautions, upgrade_notes, four_year_suitability, priority_score, is_published, feature_on_home, last_checked, created_at, updated_at" as const;

type PublicLaptop = WithAffiliateCta<Laptop>;
type PublicLaptopRow = Omit<Laptop, "amazon_affiliate_url">;

async function decoratePublicLaptops(
  rows: readonly PublicLaptopRow[],
  client: GrowthAgentDatabaseClient
): Promise<PublicLaptop[]> {
  const metadata = await getAffiliateCtaMetadataForLaptops(
    rows.map((row) => row.id),
    { client }
  );
  return rows.map((row) => ({
    ...row,
    // Preserve the legacy runtime shape without exposing its stored value.
    // Any accidental old consumer still reaches the centralized route.
    amazon_affiliate_url: buildAffiliateOutboundPath({
      laptopId: row.id,
      placement: "product_card",
    }),
    affiliateCta: metadata.get(row.id) ?? null,
  }));
}

// Public cached laptop queries. All use the admin (service-role) client so
// they don't need cookies and can be called inside `use cache` scopes.
// Invalidate with revalidateTag('laptops') after any laptop mutation.

export async function getPublishedLaptopsForDomain(domainId: string): Promise<PublicLaptop[]> {
  "use cache";
  cacheTag("laptops");
  cacheLife("minutes");
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("laptops")
    .select(PUBLIC_LAPTOP_SELECT)
    .eq("is_published", true)
    .eq("domain", domainId)
    .order("priority_score", { ascending: false });
  return decoratePublicLaptops(data ?? [], supabase);
}

// Feeds the home hub's picks carousel. Selection happens in home-picks.ts from
// the whole published catalog, so this deliberately does *not* filter on
// `feature_on_home` — that column is now an admin pin, not the pick list.
// No affiliate decoration: the cards link to the on-site domain page, never
// straight out to a retailer.
const HOME_PICK_SELECT =
  "id, slug, domain, name, brand, price_approx, price_label, image_url, cpu, gpu, gpu_vram_gb, ram_gb, storage_gb, tier, four_year_suitability, priority_score, availability, feature_on_home" as const;

export async function getHomePickCandidates(): Promise<HomePickCandidate[]> {
  "use cache";
  cacheTag("laptops");
  cacheLife("minutes");
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("laptops")
    .select(HOME_PICK_SELECT)
    .eq("is_published", true)
    .order("priority_score", { ascending: false });
  return (data ?? []) as HomePickCandidate[];
}

export async function getAllPublishedLaptops(): Promise<PublicLaptop[]> {
  "use cache";
  cacheTag("laptops");
  cacheLife("minutes");
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("laptops")
    .select(PUBLIC_LAPTOP_SELECT)
    .eq("is_published", true)
    .order("priority_score", { ascending: false });
  return decoratePublicLaptops(data ?? [], supabase);
}

// Site-wide public settings (whatsapp_url, disclaimer_text, etc.).
// Cached for hours — invalidate with revalidateTag('settings') when admin saves.
export async function getPublicSettings(): Promise<Record<string, string>> {
  "use cache";
  cacheTag("settings");
  cacheLife("hours");
  const supabase = createAdminClient();
  const { data } = await supabase.from("settings").select("key, value");
  return Object.fromEntries(
    (data ?? []).map((s: { key: string; value: string }) => [s.key, s.value])
  );
}
