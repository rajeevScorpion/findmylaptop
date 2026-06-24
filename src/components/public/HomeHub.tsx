import Link from "next/link";
import { ArrowRight, Bot, Clock, CalendarDays } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getDomainFlags, getBlogFlags } from "@/lib/flags";
import { getPublishedPosts } from "@/lib/blog/queries";
import { DOMAIN_ORDER, type DomainId } from "@/lib/domains";
import { HardwareExplainer } from "@/components/public/HardwareExplainer";
import { EditorsPicks } from "@/components/public/EditorsPicks";
import { TrustSection } from "@/components/public/TrustSection";
import { WhatsAppCTA } from "@/components/public/WhatsAppCTA";
import { VisitCounter } from "@/components/public/VisitCounter";
import { Disclaimer } from "@/components/public/Disclaimer";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SiteHeader } from "@/components/public/SiteHeader";
import type { Laptop } from "@/lib/types";

// Discipline-agnostic landing hub at /. Introduces all three domains and routes
// the visitor into the right one. Deliberately omits the finder, domain tabs,
// and Chip (Chip is scoped to the per-domain pages). Only flag-enabled domains
// are shown — Design is always on.
function formatDate(value: string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export async function HomeHub() {
  const supabase = await createClient();

  const [flags, blogFlags] = await Promise.all([getDomainFlags(), getBlogFlags()]);

  // Design is always enabled; the other two follow their flags.
  const enabledDomains = DOMAIN_ORDER.filter((d) => !d.flagKey || flags[d.flagKey]);
  const enabledIds = new Set<DomainId>(enabledDomains.map((d) => d.id));

  const { data: featuredRaw } = await supabase
    .from("laptops")
    .select("*")
    .eq("is_published", true)
    .eq("feature_on_home", true)
    .order("priority_score", { ascending: false });

  // Never surface a pick from a domain that isn't live yet.
  const featured: Laptop[] = ((featuredRaw ?? []) as Laptop[])
    .filter((l) => !l.domain || enabledIds.has(l.domain as DomainId))
    .slice(0, 6);

  const { data: settings } = await supabase.from("settings").select("key, value");
  const settingsMap = Object.fromEntries(
    (settings ?? []).map((s: { key: string; value: string }) => [s.key, s.value])
  );

  const blogPublic = blogFlags.blog_enabled && blogFlags.blog_public_enabled;
  const recentPosts = blogPublic ? (await getPublishedPosts()).slice(0, 3) : [];

  return (
    <main className="min-h-screen">
      <SiteHeader className="fixed top-4 left-4 z-50" />
      <Link
        href="/blog"
        className="fixed top-4 right-16 z-50 inline-flex h-9 items-center rounded-xl glass-card border px-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors shadow-sm"
      >
        Blog
      </Link>
      <ThemeToggle />

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="px-4 pt-36 pb-16 max-w-3xl mx-auto text-center">
        <span className="inline-flex items-center rounded-full glass-card border px-3 py-1 text-xs font-medium text-muted-foreground">
          Honest laptop guidance for Indian students
        </span>
        <h1 className="mt-7 text-4xl sm:text-5xl font-bold tracking-tight text-foreground">
          Find the right laptop for{" "}
          <span className="text-primary">the work you actually do</span>
        </h1>
        <p className="mt-5 text-base sm:text-lg text-muted-foreground leading-relaxed">
          The right laptop depends entirely on your field. Pick your discipline below and
          we&apos;ll match you to hardware built for it — no spec-sheet jargon, no upselling.
        </p>
        <p className="mt-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground/80">
          <Bot className="w-4 h-4 text-violet-500" />
          Meet Chip, our friendly advisor — chat with them inside any discipline.
        </p>
      </section>

      {/* ── Domain path cards ──────────────────────────────────── */}
      <section className="px-4 pb-20 max-w-5xl mx-auto w-full">
        <h2 className="mb-6 text-center text-sm font-semibold uppercase tracking-widest text-muted-foreground/70">
          Choose your domain
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {enabledDomains.map((d) => (
            <Link
              key={d.id}
              href={d.route}
              data-domain={d.id}
              className="laptop-card glass-card rounded-2xl border p-6 flex flex-col gap-3 hover:border-border transition-colors group"
            >
              <h3 className="text-lg font-semibold text-foreground">{d.label}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                {d.hubBlurb}
              </p>
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                Explore {d.label.toLowerCase()} laptops
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <HardwareExplainer />

      <EditorsPicks laptops={featured} />

      {/* ── Recent blog posts ──────────────────────────────────── */}
      {recentPosts.length > 0 && (
        <section className="px-4 py-16 max-w-6xl mx-auto w-full">
          <div className="flex items-end justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl font-bold text-foreground">From the guides</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Practical, jargon-free reads on choosing and using your laptop.
              </p>
            </div>
            <Link
              href="/blog"
              className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors shrink-0"
            >
              Read all guides
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {recentPosts.map((post) => (
              <div
                key={post.id}
                className="laptop-card glass-card rounded-2xl border p-5 flex flex-col gap-3 hover:border-border transition-colors relative"
              >
                <Link
                  href={`/blog/${post.slug}`}
                  aria-label={post.title}
                  className="absolute inset-0 rounded-2xl"
                />
                <h3 className="text-base font-semibold text-foreground leading-snug">
                  {post.title}
                </h3>
                {post.excerpt && (
                  <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                    {post.excerpt}
                  </p>
                )}
                <div className="mt-auto flex items-center gap-4 text-xs text-muted-foreground pt-2">
                  {post.published_at && (
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="w-3.5 h-3.5" />
                      {formatDate(post.published_at)}
                    </span>
                  )}
                  {post.reading_time_minutes ? (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {post.reading_time_minutes} min read
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 sm:hidden">
            <Link
              href="/blog"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              Read all guides
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      )}

      <TrustSection />
      <WhatsAppCTA whatsappUrl={settingsMap["whatsapp_url"]} />
      <VisitCounter />
      <Disclaimer text={settingsMap["disclaimer_text"]} />
      <WhatsAppCTA whatsappUrl={settingsMap["whatsapp_url"]} variant="floating" />
    </main>
  );
}
