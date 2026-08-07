import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  BLOG_FLAG_KEYS,
  DOMAIN_FLAG_KEYS,
  type BlogFlags,
  type DomainFlags,
} from "@/lib/flag-keys";
import { DOMAIN_ORDER, type DomainId } from "@/lib/domains";

// Re-export types and constants so existing callers of @/lib/flags still work.
export type { BlogFlagKey, BlogFlags, DomainFlagKey, DomainFlags } from "@/lib/flag-keys";
export { BLOG_FLAG_KEYS, DOMAIN_FLAG_KEYS } from "@/lib/flag-keys";

// Safe defaults if the DB lookup fails: public-facing features OFF, so a
// settings outage can never silently expose unreviewed content.
const SAFE_DEFAULTS: BlogFlags = {
  blog_enabled: false,
  blog_public_enabled: false,
  ai_blog_writer_enabled: false,
  blog_product_blocks_enabled: false,
  blog_schema_enabled: false,
  blog_auto_sitemap_enabled: false,
};

const DOMAIN_SAFE_DEFAULTS: DomainFlags = {
  domain_tech_enabled: false,
  domain_mgmt_enabled: false,
};

function toBool(value: string | undefined, fallback: boolean): boolean {
  if (value == null) return fallback;
  return value.trim().toLowerCase() === "true";
}

export async function getDomainFlags(): Promise<DomainFlags> {
  "use cache";
  cacheTag("flags");
  cacheLife("hours");
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", DOMAIN_FLAG_KEYS);

    if (error || !data) return { ...DOMAIN_SAFE_DEFAULTS };

    const map = Object.fromEntries(
      data.map((r: { key: string; value: string }) => [r.key, r.value])
    );

    return {
      domain_tech_enabled: toBool(map["domain_tech_enabled"], false),
      domain_mgmt_enabled: toBool(map["domain_mgmt_enabled"], false),
    };
  } catch {
    return { ...DOMAIN_SAFE_DEFAULTS };
  }
}

/**
 * The domains a visitor may actually be sent to, in tab order. Design has no
 * flag and is always on; the other two follow their settings flag. Callers that
 * offer a choice of domain (notably the Chip domain router) must use this — a
 * route whose flag is off answers with notFound().
 */
export async function getEnabledDomainIds(): Promise<DomainId[]> {
  const flags = await getDomainFlags();
  return DOMAIN_ORDER.filter((d) => !d.flagKey || flags[d.flagKey]).map((d) => d.id);
}

// Cached across requests via `use cache`. Uses the admin (service-role) client
// so the read is not affected by RLS. Invalidate with revalidateTag('flags').
export async function getBlogFlags(): Promise<BlogFlags> {
  "use cache";
  cacheTag("flags");
  cacheLife("hours");
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", BLOG_FLAG_KEYS);

    if (error || !data) return { ...SAFE_DEFAULTS };

    const map = Object.fromEntries(
      data.map((r: { key: string; value: string }) => [r.key, r.value])
    );

    return {
      blog_enabled: toBool(map["blog_enabled"], true),
      blog_public_enabled: toBool(map["blog_public_enabled"], false),
      ai_blog_writer_enabled: toBool(map["ai_blog_writer_enabled"], false),
      blog_product_blocks_enabled: toBool(map["blog_product_blocks_enabled"], false),
      blog_schema_enabled: toBool(map["blog_schema_enabled"], true),
      blog_auto_sitemap_enabled: toBool(map["blog_auto_sitemap_enabled"], true),
    };
  } catch {
    return { ...SAFE_DEFAULTS };
  }
}
