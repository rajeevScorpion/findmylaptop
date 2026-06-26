import { cacheLife, cacheTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Laptop } from "@/lib/types";

// Public cached laptop queries. All use the admin (service-role) client so
// they don't need cookies and can be called inside `use cache` scopes.
// Invalidate with revalidateTag('laptops') after any laptop mutation.

export async function getPublishedLaptopsForDomain(domainId: string): Promise<Laptop[]> {
  "use cache";
  cacheTag("laptops");
  cacheLife("minutes");
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("laptops")
    .select("*")
    .eq("is_published", true)
    .eq("domain", domainId)
    .order("priority_score", { ascending: false });
  return (data ?? []) as Laptop[];
}

export async function getFeaturedLaptops(): Promise<Laptop[]> {
  "use cache";
  cacheTag("laptops");
  cacheLife("minutes");
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("laptops")
    .select("*")
    .eq("is_published", true)
    .eq("feature_on_home", true)
    .order("priority_score", { ascending: false });
  return (data ?? []) as Laptop[];
}

export async function getAllPublishedLaptops(): Promise<Laptop[]> {
  "use cache";
  cacheTag("laptops");
  cacheLife("minutes");
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("laptops")
    .select("*")
    .eq("is_published", true)
    .order("priority_score", { ascending: false });
  return (data ?? []) as Laptop[];
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
