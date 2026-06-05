import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, ArrowLeft } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { LaptopRedirect } from "./LaptopRedirect";

type Props = { params: Promise<{ slug: string }> };

async function getLaptop(slug: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("laptops")
    .select("id, slug, name, brand, model, price_label, price_approx, image_url, is_published, tier, recommended_for_courses, why_recommended, amazon_affiliate_url")
    .eq("slug", slug)
    .single();
  return data;
}

async function getAlternatives(tier: string | null, courses: string[], excludeId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("laptops")
    .select("id, slug, name, brand, price_label, image_url, tier, recommended_for_courses, amazon_affiliate_url")
    .eq("is_published", true)
    .neq("id", excludeId)
    .order("priority_score", { ascending: false });

  if (!data) return [];

  return data
    .filter((l) => {
      const sameTier = tier ? l.tier === tier : true;
      const courseOverlap = l.recommended_for_courses?.some((c: string) => courses.includes(c));
      return sameTier && courseOverlap;
    })
    .slice(0, 3);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const laptop = await getLaptop(slug);

  if (!laptop) {
    return { title: "Laptop not found — Find My Laptop" };
  }

  const title = `${laptop.name} — Find My Laptop`;
  const description = laptop.why_recommended
    ? laptop.why_recommended.slice(0, 160)
    : `${laptop.brand ?? ""} ${laptop.name} — personalised laptop recommendations for designers.`.trim();

  const ogImageUrl = `/api/og?slug=${slug}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: laptop.name }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function LaptopPage({ params }: Props) {
  const { slug } = await params;
  const laptop = await getLaptop(slug);

  // Published — redirect to homepage with highlight
  if (laptop?.is_published) {
    return <LaptopRedirect slug={slug} />;
  }

  // Not found or unpublished — show not-available page
  const alternatives = laptop
    ? await getAlternatives(laptop.tier, laptop.recommended_for_courses ?? [], laptop.id)
    : [];

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-16">
      <div className="max-w-3xl mx-auto">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-10"
        >
          <ArrowLeft className="w-4 h-4" />
          Browse all laptops
        </Link>

        {/* Not available message */}
        <div className="glass-card rounded-2xl border p-8 mb-10 text-center">
          <p className="text-3xl mb-3">🪦</p>
          <h1 className="text-xl font-semibold text-foreground mb-2">
            {laptop?.name ? `${laptop.name} is no longer available` : "This laptop is no longer available"}
          </h1>
          <p className="text-sm text-muted-foreground">
            It may have been discontinued or removed from our catalog.
          </p>
        </div>

        {/* Alternatives */}
        {alternatives.length > 0 && (
          <>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-5">
              Similar options you might like
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {alternatives.map((alt) => (
                <div key={alt.id} className="glass-card rounded-2xl border overflow-hidden flex flex-col">
                  {alt.image_url && (
                    <div className="h-40 bg-white/[0.03] flex items-center justify-center overflow-hidden border-b border-border/30 p-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={alt.image_url}
                        alt={alt.name}
                        className="h-full w-full object-contain"
                        loading="lazy"
                      />
                    </div>
                  )}
                  <div className="p-4 flex flex-col gap-3 flex-1">
                    <div>
                      {alt.brand && <p className="text-xs text-muted-foreground">{alt.brand}</p>}
                      <h3 className="text-sm font-semibold text-foreground leading-snug">{alt.name}</h3>
                      {alt.price_label && (
                        <p className="text-sm font-bold text-foreground mt-0.5">{alt.price_label}</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 mt-auto">
                      <a
                        href={alt.amazon_affiliate_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        See on Amazon
                      </a>
                      <Link
                        href={`/?highlight=${alt.slug}`}
                        className="inline-flex items-center justify-center w-full py-2 rounded-lg text-xs font-medium border border-border/60 text-muted-foreground hover:text-foreground hover:border-border transition-colors"
                      >
                        View on Find My Laptop →
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
