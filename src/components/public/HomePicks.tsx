"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { TIER_LABELS } from "@/lib/constants";
import { DOMAINS } from "@/lib/domains";
import { catalogDisplayPrice } from "@/lib/affiliate/public";
import type { HomePick, HomePickSlide } from "@/lib/home-picks";

// The hub's headline hook: a slide per selection theme ("Value for money",
// "Power house"), each holding two automatically-chosen cards per live domain.
// Cards link to the on-site domain page (never straight to a retailer) so the
// hub stays editorial.

const TIER_COLORS: Record<string, string> = {
  budget: "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400",
  value: "bg-sky-500/10 border-sky-500/30 text-sky-700 dark:text-sky-400",
  balanced: "bg-violet-500/10 border-violet-500/30 text-violet-700 dark:text-violet-400",
  advanced: "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400",
  premium: "bg-pink-500/10 border-pink-500/30 text-pink-700 dark:text-pink-400",
};

const AUTO_ADVANCE_MS = 7000;
/** Ignore incidental horizontal drift while the user is scrolling vertically. */
const SWIPE_THRESHOLD_PX = 48;

function PickCard({ pick }: { pick: HomePick }) {
  const price = catalogDisplayPrice(pick);
  const domainLabel = DOMAINS[pick.domain].label;

  return (
    <Link
      href={`/${pick.domain}?highlight=${pick.slug}`}
      className="laptop-card glass-card group relative flex flex-col overflow-hidden rounded-2xl border text-left hover:border-border"
    >
      {/* Diagonal corner ribbon, coloured per domain. Purely decorative — the
          domain is already named in the card's accessible label below. */}
      <div className="corner-ribbon" data-domain={pick.domain} aria-hidden="true">
        <span>{domainLabel}</span>
      </div>

      <div className="flex h-32 items-center justify-center overflow-hidden border-b border-border/30 bg-white/[0.03] px-6 pt-4">
        {pick.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pick.image_url}
            alt=""
            className="h-full w-auto max-w-full object-contain transition-transform duration-300 group-hover:scale-[1.04]"
            loading="lazy"
          />
        ) : (
          <span className="text-2xl font-semibold text-muted-foreground/50">
            {(pick.brand ?? "?").slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
          {pick.name}
        </h3>

        {pick.specSummary && (
          <p className="line-clamp-1 text-xs text-muted-foreground">{pick.specSummary}</p>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          {price ? (
            <span className="text-base font-bold tabular-nums text-foreground">{price}</span>
          ) : (
            <span />
          )}
          {pick.tier && (
            <span
              className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${TIER_COLORS[pick.tier] ?? ""}`}
            >
              {TIER_LABELS[pick.tier] ?? pick.tier}
            </span>
          )}
        </div>

        <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
          Learn more
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>

      <span className="sr-only">{`${pick.name}, ${domainLabel} pick`}</span>
    </Link>
  );
}

export function HomePicks({ slides }: { slides: HomePickSlide[] }) {
  const [active, setActive] = useState(0);
  // Any deliberate navigation stops the carousel moving on its own — after that
  // the visitor is driving.
  const [autoPlay, setAutoPlay] = useState(true);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const goTo = useCallback((index: number) => {
    setActive(index);
    setAutoPlay(false);
  }, []);

  const step = useCallback(
    (delta: number) => {
      setActive((current) => (current + delta + slides.length) % slides.length);
      setAutoPlay(false);
    },
    [slides.length]
  );

  useEffect(() => {
    if (!autoPlay || paused || slides.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(
      () => setActive((current) => (current + 1) % slides.length),
      AUTO_ADVANCE_MS
    );
    return () => window.clearInterval(timer);
  }, [autoPlay, paused, slides.length]);

  if (slides.length === 0) return null;

  const multiSlide = slides.length > 1;

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16">
      <div className="mb-6 text-center">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Top picks
        </span>
        <h2 className="mt-2 text-2xl font-bold text-foreground">
          {slides[active].title}
        </h2>
        <p className="mx-auto mt-1 max-w-2xl text-sm text-muted-foreground">
          {slides[active].blurb}
        </p>
      </div>

      {/* Nav sits above the grid rather than floating over it — with only a
          couple of named slides the labels do the real work, and edge arrows
          would overlap the outer cards. */}
      {multiSlide && (
        <div className="mb-6 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label="Previous picks"
            className="glass-card hidden h-8 w-8 shrink-0 items-center justify-center rounded-full border text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div
            role="tablist"
            aria-label="Pick categories"
            className="glass-card inline-flex rounded-full border p-1"
          >
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                role="tab"
                type="button"
                id={`home-picks-tab-${slide.id}`}
                aria-selected={index === active}
                aria-controls={`home-picks-panel-${slide.id}`}
                onClick={() => goTo(index)}
                className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors sm:text-sm ${
                  index === active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {slide.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => step(1)}
            aria-label="Next picks"
            className="glass-card hidden h-8 w-8 shrink-0 items-center justify-center rounded-full border text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      <div
        className="relative"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={() => setPaused(false)}
      >
        <div
          className="overflow-hidden"
          onTouchStart={(event) => {
            touchStartX.current = event.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(event) => {
            const start = touchStartX.current;
            touchStartX.current = null;
            if (start === null || !multiSlide) return;
            const delta = (event.changedTouches[0]?.clientX ?? start) - start;
            if (Math.abs(delta) > SWIPE_THRESHOLD_PX) step(delta < 0 ? 1 : -1);
          }}
        >
          <div
            className="flex motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-out"
            style={{ transform: `translateX(-${active * 100}%)` }}
          >
            {slides.map((slide, index) => (
              <div
                key={slide.id}
                id={`home-picks-panel-${slide.id}`}
                role={multiSlide ? "tabpanel" : undefined}
                aria-labelledby={multiSlide ? `home-picks-tab-${slide.id}` : undefined}
                // `inert` keeps off-screen cards out of the tab order and the
                // accessibility tree without hiding focused content.
                inert={index !== active}
                className="w-full shrink-0 px-1"
              >
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {slide.picks.map((pick) => (
                    <PickCard key={pick.slug} pick={pick} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground/80">
        Chosen automatically from the published catalog — picks and prices move with the market.
      </p>
    </section>
  );
}
