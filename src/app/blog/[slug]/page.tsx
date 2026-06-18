import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, CalendarDays, ListTree } from "lucide-react";
import { getBlogFlags } from "@/lib/flags";
import { getPublishedPostBySlug, getRelatedPosts } from "@/lib/blog/queries";
import { BlockRenderer } from "@/components/blog/BlockRenderer";
import { ShareButton } from "@/components/blog/ShareButton";
import { buildToc } from "@/lib/blog/toc";
import type { BlogContentDoc, Block, FaqItem } from "@/lib/blog/types";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/public/SiteHeader";
import { WhatsAppCTA } from "@/components/public/WhatsAppCTA";
import { ChatWidgetLoader } from "@/components/public/ChatWidgetLoader";
import type { Laptop } from "@/lib/types";

export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://laptopfinder.cc";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const flags = await getBlogFlags();
  if (!flags.blog_enabled || !flags.blog_public_enabled) {
    return { title: "Not found — laptopfinder.cc" };
  }
  const post = await getPublishedPostBySlug(slug);
  if (!post) return { title: "Not found — laptopfinder.cc" };

  const title = post.meta_title || `${post.title} — laptopfinder.cc`;
  const description =
    post.meta_description || post.excerpt || `${post.title} — a LaptopFinder buying guide.`;
  const canonical = post.canonical_url || `/blog/${post.slug}`;
  // Use the post's own OG image when set, otherwise fall back to the
  // site-wide landing page cover so shares always render a preview image.
  const ogImage = post.og_image_url || "/sharing-cover.png";

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title: post.og_title || title,
      description: post.og_description || description,
      type: "article",
      url: canonical,
      images: [{ url: ogImage, width: 1200, height: 630, alt: post.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: post.og_title || title,
      description: post.og_description || description,
      images: [ogImage],
    },
  };
}

function formatDate(value: string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const flags = await getBlogFlags();
  if (!flags.blog_enabled || !flags.blog_public_enabled) notFound();

  const post = await getPublishedPostBySlug(slug);
  if (!post) notFound();

  const doc = (post.content_json as BlogContentDoc | null) ?? { type: "doc", blocks: [] };
  const toc = post.toc_json?.length ? post.toc_json : buildToc(doc);
  const related = await getRelatedPosts({ id: post.id, category_id: post.category_id });

  const supabase = await createClient();
  const { data: laptopsRaw } = await supabase
    .from("laptops")
    .select("*")
    .eq("is_published", true)
    .order("priority_score", { ascending: false });
  const { data: settings } = await supabase.from("settings").select("key, value");
  const settingsMap = Object.fromEntries(
    (settings ?? []).map((s: { key: string; value: string }) => [s.key, s.value])
  );
  const laptops: Laptop[] = (laptopsRaw ?? []) as Laptop[];

  // FAQ items (for schema) only from visible FAQ blocks.
  const faqItems: FaqItem[] = doc.blocks
    .filter((b): b is Extract<Block, { type: "faq" }> => (b as Block)?.type === "faq")
    .flatMap((b) => b.items);

  const lastUpdated = post.updated_at || post.published_at;

  // JSON-LD — only when enabled and only for visible content.
  const jsonLd: Record<string, unknown>[] = [];
  if (flags.blog_schema_enabled) {
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: post.title,
      description: post.meta_description || post.excerpt || undefined,
      datePublished: post.published_at || undefined,
      dateModified: lastUpdated || undefined,
      author: { "@type": "Organization", name: "LaptopFinder" },
      publisher: { "@type": "Organization", name: "LaptopFinder" },
      mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`,
    });
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}/blog` },
        {
          "@type": "ListItem",
          position: 3,
          name: post.title,
          item: `${SITE_URL}/blog/${post.slug}`,
        },
      ],
    });
    if (faqItems.length > 0) {
      jsonLd.push({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqItems.map((f) => ({
          "@type": "Question",
          name: f.question,
          acceptedAnswer: { "@type": "Answer", text: f.answer },
        })),
      });
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-12 sm:py-16">
      {jsonLd.map((obj, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(obj) }}
        />
      ))}

      <div className="max-w-5xl mx-auto">
        <SiteHeader showCta className="mb-8" />

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
          <Link href="/blog" className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            All guides
          </Link>
        </nav>

        <div className="lg:grid lg:grid-cols-[1fr_220px] lg:gap-10">
          <article className="min-w-0">
            {/* Hero fallback if the doc has no hero block */}
            {!doc.blocks.some((b) => (b as Block)?.type === "hero") && (
              <header className="mb-8">
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight">
                  {post.title}
                </h1>
                {post.excerpt && (
                  <p className="mt-3 text-base text-muted-foreground leading-relaxed">
                    {post.excerpt}
                  </p>
                )}
              </header>
            )}

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mb-8 pb-6 border-b border-border/40">
              {lastUpdated && (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5" />
                  Last updated: {formatDate(lastUpdated)}
                </span>
              )}
              {post.reading_time_minutes ? (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  {post.reading_time_minutes} min read
                </span>
              ) : null}
              <ShareButton url={`${SITE_URL}/blog/${post.slug}`} title={post.title} className="ml-auto" />
            </div>

            <BlockRenderer
              blocks={doc.blocks}
              laptops={laptops}
              productBlocksEnabled={flags.blog_product_blocks_enabled}
            />

            {/* Related posts */}
            {related.length > 0 && (
              <section className="mt-12 pt-8 border-t border-border/40">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-5">
                  Related guides
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {related.map((r) => (
                    <Link
                      key={r.id}
                      href={`/blog/${r.slug}`}
                      className="glass-card rounded-xl border p-4 hover:border-border transition-colors"
                    >
                      <p className="text-sm font-medium text-foreground leading-snug">{r.title}</p>
                      {r.excerpt && (
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{r.excerpt}</p>
                      )}
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </article>

          {/* TOC sidebar */}
          {toc.length > 0 && (
            <aside className="hidden lg:block">
              <div className="sticky top-24">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                  <ListTree className="w-3.5 h-3.5" />
                  On this page
                </p>
                <nav className="space-y-1.5 text-sm">
                  {toc.map((entry) => (
                    <a
                      key={entry.id}
                      href={`#${entry.id}`}
                      className={`block text-muted-foreground hover:text-foreground transition-colors ${
                        entry.level === 3 ? "pl-3" : ""
                      }`}
                    >
                      {entry.text}
                    </a>
                  ))}
                </nav>
              </div>
            </aside>
          )}
        </div>
      </div>

      <WhatsAppCTA whatsappUrl={settingsMap["whatsapp_url"]} variant="floating" />
      <ChatWidgetLoader laptops={laptops} />
    </div>
  );
}
