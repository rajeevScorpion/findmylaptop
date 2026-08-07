import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cacheLife, cacheTag } from "next/cache";
import { ArrowLeft, Clock, CalendarDays, ListTree } from "lucide-react";
import { getBlogFlags, getEnabledDomainIds } from "@/lib/flags";
import {
  getPublishedPostBySlug,
  getPublishedPostSlugs,
  getRelatedPosts,
} from "@/lib/blog/queries";
import { BlockRenderer } from "@/components/blog/BlockRenderer";
import { ShareButton } from "@/components/blog/ShareButton";
import { AuthorCard } from "@/components/blog/AuthorCard";
import { serializeJsonLd } from "@/lib/json-ld";
import { buildToc } from "@/lib/blog/toc";
import { placeEditorialCardAfterFaq } from "@/lib/blog/editorial-card";
import type { BlogContentDoc, Block, FaqItem } from "@/lib/blog/types";
import { getAllPublishedLaptops } from "@/lib/laptop-queries";
import { SiteHeader } from "@/components/public/SiteHeader";
import { ChipDomainRouterLoader } from "@/components/public/ChipDomainRouterLoader";

type Props = { params: Promise<{ slug: string }> };

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://laptopfinder.cc";

// Prerender every published guide so a click serves a cached payload instead of
// a fresh render. Slugs published after the build still render on demand and
// are cached from their first request.
export async function generateStaticParams() {
  try {
    const posts = await getPublishedPostSlugs();
    return posts.map(({ slug }) => ({ slug }));
  } catch {
    // A data blip must never fail the build — everything falls back to
    // on-demand rendering.
    return [];
  }
}

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

/**
 * Shown for the sliver of time between the click and the article arriving —
 * only on a cold cache, since prerendered guides swap in immediately.
 */
function ArticleSkeleton() {
  return (
    <div className="lg:grid lg:grid-cols-[1fr_220px] lg:gap-10" role="status" aria-label="Loading guide">
      <div className="min-w-0 animate-pulse">
        <div className="h-8 w-4/5 rounded-lg bg-muted" />
        <div className="mt-3 h-4 w-full rounded bg-muted/70" />
        <div className="mt-2 h-4 w-2/3 rounded bg-muted/70" />
        <div className="mt-8 mb-8 flex gap-4 border-b border-border/40 pb-6">
          <div className="h-3 w-36 rounded bg-muted/70" />
          <div className="h-3 w-24 rounded bg-muted/70" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-4 rounded bg-muted/60"
              style={{ width: `${[100, 96, 88, 100, 92, 70, 98, 84][i]}%` }}
            />
          ))}
        </div>
      </div>
      <div className="hidden lg:block">
        <div className="h-3 w-28 rounded bg-muted/70" />
        <div className="mt-4 space-y-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-3 rounded bg-muted/50" style={{ width: `${[90, 75, 85, 60, 80][i]}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * The whole article, cached per slug. Everything it reads is itself cached, so
 * repeat views (and every reader after the first) skip Supabase entirely.
 * Nested `use cache` scopes propagate their tags here, which means the existing
 * `revalidateTag('blog' | 'flags' | 'laptops')` calls already invalidate it.
 */
async function BlogArticle({ slug }: { slug: string }) {
  "use cache";
  cacheTag("blog");
  cacheLife("days");

  const flags = await getBlogFlags();
  if (!flags.blog_enabled || !flags.blog_public_enabled) notFound();

  const post = await getPublishedPostBySlug(slug);
  if (!post) notFound();

  const doc = (post.content_json as BlogContentDoc | null) ?? { type: "doc", blocks: [] };
  const toc = post.toc_json?.length ? post.toc_json : buildToc(doc);
  const related = await getRelatedPosts({ id: post.id, category_id: post.category_id });

  // Product blocks inside the article need the catalog. Loading it is the most
  // expensive read on the page (whole catalog + affiliate resolution) and it
  // pins this entry to the catalog's short cache life, so only pay for it when
  // the article actually has a product block to fill.
  const hasProductBlocks = doc.blocks.some(
    (b) => (b as Block)?.type === "product_grid_placeholder"
  );
  const laptops =
    flags.blog_product_blocks_enabled && hasProductBlocks
      ? await getAllPublishedLaptops()
      : [];

  // FAQ items (for schema) only from visible FAQ blocks.
  const faqItems: FaqItem[] = doc.blocks
    .filter((b): b is Extract<Block, { type: "faq" }> => (b as Block)?.type === "faq")
    .flatMap((b) => b.items);

  const lastUpdated = post.updated_at || post.published_at;
  const authorSnapshot = post.author_persona_snapshot_json;
  const editorialCardPlacement = authorSnapshot
    ? placeEditorialCardAfterFaq(doc.blocks)
    : null;
  const blocksBeforeEditorialCard =
    editorialCardPlacement?.beforeCard ?? doc.blocks;
  const blocksAfterEditorialCard = editorialCardPlacement?.afterCard ?? [];
  const schemaAuthor = authorSnapshot
    ? {
        "@type": authorSnapshot.authorType === "human" ? "Person" : "Organization",
        name: authorSnapshot.displayName,
        url: `${SITE_URL}/blog/author/${authorSnapshot.slug}`,
        description: `${authorSnapshot.shortBio} ${authorSnapshot.disclosureText}`,
      }
    : { "@type": "Organization", name: "LaptopFinder" };

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
      author: schemaAuthor,
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
    <>
      {jsonLd.map((obj, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(obj) }}
        />
      ))}

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
            blocks={blocksBeforeEditorialCard}
            laptops={laptops}
            productBlocksEnabled={flags.blog_product_blocks_enabled}
          />

          {authorSnapshot && (
            <AuthorCard
              persona={authorSnapshot}
              generatedDisclosure={editorialCardPlacement?.generatedDisclosure}
              className="my-8"
            />
          )}

          {blocksAfterEditorialCard.length > 0 && (
            <BlockRenderer
              blocks={blocksAfterEditorialCard}
              laptops={laptops}
              productBlocksEnabled={flags.blog_product_blocks_enabled}
            />
          )}

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
    </>
  );
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;

  // Resolved at build for every guide in `generateStaticParams`. Deliberately
  // outside the article: a missing guide has to answer with a real 404, and a
  // status code cannot be changed once the shell has streamed.
  const flags = await getBlogFlags();
  if (!flags.blog_enabled || !flags.blog_public_enabled) notFound();
  if (!(await getPublishedPostBySlug(slug))) notFound();

  // Part of the page chrome, not the article — so it is there from the first
  // paint rather than waiting behind the article's Suspense boundary.
  const enabledIds = await getEnabledDomainIds();

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-12 sm:py-16">
      <div className="max-w-5xl mx-auto">
        <SiteHeader showCta className="mb-8" />

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
          <Link href="/blog" className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            All guides
          </Link>
        </nav>

        {/* Guides published since the last build render on demand — stream the
            chrome first so they are not a blank screen. */}
        <Suspense fallback={<ArticleSkeleton />}>
          <BlogArticle slug={slug} />
        </Suspense>
      </div>

      {/* Chip has no discipline to reason about here, so it asks for one and
          hands off to the real advisor on that domain's page. */}
      <ChipDomainRouterLoader enabledIds={enabledIds} />
    </div>
  );
}
