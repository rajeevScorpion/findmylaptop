import Link from "next/link";
import { Sparkles } from "lucide-react";
import { TIER_LABELS } from "@/lib/constants";
import { DOMAINS, type DomainId } from "@/lib/domains";
import type { Laptop } from "@/lib/types";

const TIER_COLORS: Record<string, string> = {
  budget: "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400",
  value: "bg-sky-500/10 border-sky-500/30 text-sky-700 dark:text-sky-400",
  balanced: "bg-violet-500/10 border-violet-500/30 text-violet-700 dark:text-violet-400",
  advanced: "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400",
  premium: "bg-pink-500/10 border-pink-500/30 text-pink-700 dark:text-pink-400",
};

// Cross-discipline "Editor's Picks" rendered on the hub (/). Cards link into the
// on-site laptop detail page (not straight to Amazon) so the hub stays
// editorial, not sales-y. Renders nothing when there are no picks.
export function EditorsPicks({ laptops }: { laptops: Laptop[] }) {
  if (laptops.length === 0) return null;

  return (
    <section className="px-4 py-16 max-w-6xl mx-auto w-full">
      <div className="mb-8 text-center">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          Editor&apos;s Picks
        </span>
        <h2 className="mt-2 text-2xl font-bold text-foreground">
          A few laptops worth a look
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Hand-picked across disciplines — open the finder for your field to see the full list.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {laptops.map((laptop) => {
          const domainLabel =
            laptop.domain ? DOMAINS[laptop.domain as DomainId]?.label : null;
          return (
            <Link
              key={laptop.slug}
              href={`/laptop/${laptop.slug}`}
              className="laptop-card glass-card rounded-2xl border p-4 flex gap-4 items-start hover:border-border transition-colors"
            >
              {laptop.image_url ? (
                <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-white/5 border border-border/30 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={laptop.image_url}
                    alt={laptop.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              ) : (
                <div className="w-20 h-20 rounded-xl shrink-0 bg-muted border border-border/30 flex items-center justify-center">
                  <span className="text-sm text-muted-foreground font-semibold">
                    {(laptop.brand ?? "?").slice(0, 2).toUpperCase()}
                  </span>
                </div>
              )}

              <div className="flex-1 min-w-0 space-y-1.5">
                <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
                  {laptop.name}
                </p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {laptop.tier && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${TIER_COLORS[laptop.tier] ?? ""}`}
                    >
                      {TIER_LABELS[laptop.tier] ?? laptop.tier}
                    </span>
                  )}
                  {domainLabel && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-border/60 text-muted-foreground font-medium">
                      {domainLabel}
                    </span>
                  )}
                </div>
                {laptop.price_label && (
                  <p className="text-sm font-bold text-foreground">{laptop.price_label}</p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
