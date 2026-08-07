import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cacheLife, cacheTag } from "next/cache";
import { ArrowLeft, CalendarDays, Clock } from "lucide-react";
import { SiteHeader } from "@/components/public/SiteHeader";
import { ChipDomainRouterLoader } from "@/components/public/ChipDomainRouterLoader";
import { getBlogFlags, getEnabledDomainIds } from "@/lib/flags";
import { serializeJsonLd } from "@/lib/json-ld";
import {
  getPublicPersonaBySlug,
  getPublishedPersonaSlugs,
  getPublishedPostsForPersona,
} from "@/lib/personas/service";

type Props = { params: Promise<{ slug: string }> };

// Prerendered per author, same as the article route.
export async function generateStaticParams() {
  try {
    const personas = await getPublishedPersonaSlugs();
    return personas.map(({ slug }) => ({ slug }));
  } catch {
    return [];
  }
}

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://laptopfinder.cc"
).replace(/\/$/, "");

function formatDate(value: string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const flags = await getBlogFlags();
  if (!flags.blog_enabled || !flags.blog_public_enabled) {
    return { title: "Not found — laptopfinder.cc" };
  }
  const persona = await getPublicPersonaBySlug(slug);
  if (!persona) return { title: "Not found — laptopfinder.cc" };
  const posts = await getPublishedPostsForPersona(persona.id);
  if (posts.length === 0) return { title: "Not found — laptopfinder.cc" };
  return {
    title: `${persona.displayName} — LaptopFinder author`,
    description: persona.shortBio,
    alternates: { canonical: `/blog/author/${persona.slug}` },
    robots: { index: true, follow: true },
  };
}

function AuthorSkeleton() {
  return (
    <div className="animate-pulse" role="status" aria-label="Loading author">
      <div className="glass-card rounded-2xl border p-6 sm:p-8">
        <div className="h-7 w-56 rounded-lg bg-muted" />
        <div className="mt-3 h-3 w-40 rounded bg-muted/70" />
        <div className="mt-5 h-4 w-full rounded bg-muted/60" />
        <div className="mt-2 h-4 w-4/5 rounded bg-muted/60" />
      </div>
      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass-card h-36 rounded-xl border" />
        ))}
      </div>
    </div>
  );
}

/** Cached per slug; invalidated by the existing `blog`/`personas` tags. */
async function AuthorProfile({ slug }: { slug: string }) {
  "use cache";
  cacheTag("blog", "personas");
  cacheLife("days");

  const flags = await getBlogFlags();
  if (!flags.blog_enabled || !flags.blog_public_enabled) notFound();

  const persona = await getPublicPersonaBySlug(slug);
  if (!persona) notFound();
  const posts = await getPublishedPostsForPersona(persona.id);
  if (posts.length === 0) notFound();

  const isHuman = persona.authorType === "human";
  const profileSchema = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: {
      "@type": isHuman ? "Person" : "Organization",
      name: persona.displayName,
      description: `${persona.shortBio} ${persona.disclosureText}`,
      url: `${SITE_URL}/blog/author/${persona.slug}`,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(profileSchema) }}
      />
      <div>
        <header className="glass-card rounded-2xl border p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold sm:text-3xl">
              {persona.displayName}
            </h1>
            {!isHuman && (
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-primary">
                {persona.authorType === "brand"
                  ? "Editorial team"
                  : "AI editorial persona"}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm font-medium text-primary">
            {persona.publicRole}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Latest guide updated {formatDate(posts[0]?.updated_at ?? null)}
          </p>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {persona.shortBio}
          </p>
          <div className="mt-4 rounded-lg border border-border/50 bg-muted/20 p-3 text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground/80">Disclosure:</span>{" "}
            {persona.disclosureText}
          </div>
          {persona.expertiseTags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {persona.expertiseTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-border/60 px-2.5 py-1 text-[11px] text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </header>

        <section className="mt-10">
          <h2 className="mb-5 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Published guides
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                className="glass-card rounded-xl border p-5 transition-colors hover:border-border"
              >
                <h3 className="text-base font-semibold leading-snug text-foreground">
                  {post.title}
                </h3>
                {post.excerpt && (
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                    {post.excerpt}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                  {post.published_at && (
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {formatDate(post.published_at)}
                    </span>
                  )}
                  {post.reading_time_minutes ? (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {post.reading_time_minutes} min read
                    </span>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

export default async function BlogAuthorPage({ params }: Props) {
  const { slug } = await params;

  // Outside the cached profile so an unknown author still answers with a real
  // 404 rather than a streamed soft 404.
  const flags = await getBlogFlags();
  if (!flags.blog_enabled || !flags.blog_public_enabled) notFound();
  const persona = await getPublicPersonaBySlug(slug);
  if (!persona) notFound();
  if ((await getPublishedPostsForPersona(persona.id)).length === 0) notFound();

  const enabledIds = await getEnabledDomainIds();

  return (
    <div className="min-h-screen bg-background px-4 py-12 text-foreground sm:py-16">
      <div className="mx-auto max-w-5xl">
        <SiteHeader showCta className="mb-8" />
        <Link
          href="/blog"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          All guides
        </Link>

        <Suspense fallback={<AuthorSkeleton />}>
          <AuthorProfile slug={slug} />
        </Suspense>
      </div>

      {/* Chip has no discipline to reason about here, so it asks for one and
          hands off to the real advisor on that domain's page. */}
      <ChipDomainRouterLoader enabledIds={enabledIds} />
    </div>
  );
}
