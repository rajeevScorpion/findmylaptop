import type { MetadataRoute } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBlogFlags, getDomainFlags } from "@/lib/flags";
import { getPublishedPostSlugs } from "@/lib/blog/queries";
import { DOMAIN_ORDER } from "@/lib/domains";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://laptopfinder.cc").replace(/\/$/, "");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  "use cache";
  cacheTag("laptops", "blog", "flags");
  cacheLife("hours");

  const entries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
  ];

  // Per-domain landing pages — Design always, the others only when enabled.
  const domainFlags = await getDomainFlags();
  for (const d of DOMAIN_ORDER) {
    if (d.flagKey && !domainFlags[d.flagKey]) continue;
    entries.push({ url: `${SITE_URL}${d.route}`, changeFrequency: "weekly", priority: 0.9 });
  }

  // Published laptop detail pages.
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("laptops")
      .select("slug, updated_at")
      .eq("is_published", true);
    for (const row of data ?? []) {
      if (!row.slug) continue;
      entries.push({
        url: `${SITE_URL}/laptop/${row.slug}`,
        lastModified: row.updated_at ? new Date(row.updated_at) : undefined,
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
  } catch {
    // Never let the sitemap fail the build/route.
  }

  // Blog — only when fully enabled for the public + sitemap.
  const flags = await getBlogFlags();
  if (flags.blog_enabled && flags.blog_public_enabled && flags.blog_auto_sitemap_enabled) {
    entries.push({ url: `${SITE_URL}/blog`, changeFrequency: "weekly", priority: 0.8 });
    try {
      const posts = await getPublishedPostSlugs();
      for (const p of posts) {
        entries.push({
          url: `${SITE_URL}/blog/${p.slug}`,
          lastModified: p.updated_at ? new Date(p.updated_at) : undefined,
          changeFrequency: "monthly",
          priority: 0.6,
        });
      }
    } catch {
      // ignore — keep the rest of the sitemap
    }
  }

  return entries;
}
