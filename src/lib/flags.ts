import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

// Blog/CMS feature flags. Stored as 'true'/'false' text rows in the existing
// `settings` table (seeded by migration 013). Read server-side only.

export type BlogFlagKey =
  | "blog_enabled"
  | "blog_public_enabled"
  | "ai_blog_writer_enabled"
  | "blog_product_blocks_enabled"
  | "blog_schema_enabled"
  | "blog_auto_sitemap_enabled";

export type BlogFlags = Record<BlogFlagKey, boolean>;

export const BLOG_FLAG_KEYS: BlogFlagKey[] = [
  "blog_enabled",
  "blog_public_enabled",
  "ai_blog_writer_enabled",
  "blog_product_blocks_enabled",
  "blog_schema_enabled",
  "blog_auto_sitemap_enabled",
];

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

function toBool(value: string | undefined, fallback: boolean): boolean {
  if (value == null) return fallback;
  return value.trim().toLowerCase() === "true";
}

// Cached per-request. Uses the admin (service-role) client so the read is not
// affected by RLS, mirroring how other server pages read settings.
export const getBlogFlags = cache(async (): Promise<BlogFlags> => {
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

    // If a flag row is missing, fall back to the recommended seed default
    // (blog on, schema/sitemap on; everything risky off).
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
});
