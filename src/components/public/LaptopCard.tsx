"use client";

import { useState, useEffect, useRef } from "react";
import { LazyMotion, domAnimation, m } from "framer-motion";
import {
  ExternalLink, Cpu, Zap, MemoryStick, HardDrive,
  Monitor, Weight, CheckCircle2, AlertCircle, Info,
  Plus, Check, ChevronDown, ChevronUp, GraduationCap, Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BadgeList } from "./BadgeList";
import type { RecommendationResult } from "@/lib/types";
import { FOUR_YEAR_LABELS, TIER_LABELS } from "@/lib/constants";
import {
  affiliateCtaLabel,
  buildAffiliateOutboundPath,
  catalogDisplayPrice,
} from "@/lib/affiliate/public";
import { AffiliateCtaDetails } from "./AffiliateCtaDetails";

type CardSection = "why" | "specs" | "bestfor" | "details";

interface LaptopCardProps {
  laptop: RecommendationResult;
  onCompareToggle: (laptop: RecommendationResult) => void;
  isInCompare: boolean;
  isHighlighted?: boolean;
}

const TIER_GLOW: Record<string, string> = {
  budget:   "#34d399",
  value:    "#38bdf8",
  balanced: "#a78bfa",
  advanced: "#fbbf24",
  premium:  "#f472b6",
};

const SUITABILITY_COLORS: Record<string, string> = {
  excellent: "text-emerald-700 dark:text-emerald-400",
  strong:    "text-sky-700 dark:text-sky-400",
  good:      "text-amber-700 dark:text-amber-400",
  basic:     "text-muted-foreground",
};

export function LaptopCard({ laptop, onCompareToggle, isInCompare, isHighlighted = false }: LaptopCardProps) {
  // Only one section open at a time (accordion) to keep the card compact.
  const [openSection, setOpenSection] = useState<CardSection | null>(null);
  const [copied, setCopied]           = useState(false);

  const toggleSection = (section: CardSection) =>
    setOpenSection((prev) => (prev === section ? null : section));
  const cardRef = useRef<HTMLDivElement>(null);

  const glowColor = TIER_GLOW[laptop.tier ?? ""] ?? "#a78bfa";
  const hasDetails = laptop.cautions || laptop.upgrade_notes;
  const displayPrice = catalogDisplayPrice(laptop);

  useEffect(() => {
    if (isHighlighted && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isHighlighted]);

  async function handleShare() {
    const url = `${window.location.origin}/laptop/${laptop.slug}`;

    // Shorten the description to ~3 lines, cut on a word boundary.
    let blurb = (laptop.why_recommended ?? `Check out the ${laptop.name}`).trim();
    if (blurb.length > 140) {
      blurb = blurb.slice(0, 140).replace(/\s+\S*$/, "") + "…";
    }

    const text = [blurb, "", `Find more at: ${url}`].join("\n");

    // Note: no `url` field — WhatsApp/others append it separately, which
    // would duplicate the link we already put in `text`.
    const shareData = { title: laptop.name, text };
    try {
      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
        return;
      }
    } catch {}
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <LazyMotion features={domAnimation}>
      <m.div
        ref={cardRef}
        className={`laptop-card glass-card rounded-2xl border overflow-hidden flex flex-col group relative transition-shadow duration-700 ${isHighlighted ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
        whileHover={{ y: -5 }}
        transition={{ type: "spring", stiffness: 280, damping: 22 }}
      >
        {/* Tier glow — fades in on hover */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
          style={{
            boxShadow: `0 0 56px -12px ${glowColor}55, inset 0 0 0 1px ${glowColor}22`,
          }}
        />

        {/* Product image */}
        {laptop.image_url && (
          <div className="relative h-56 bg-white/[0.03] flex items-center justify-center overflow-hidden border-b border-border/30">
            <img
              src={laptop.image_url}
              alt={laptop.name}
              className="h-full w-full object-cover"
              loading="lazy"
            />
            {/* Fade bottom edge into card */}
            <div
              className="absolute bottom-0 inset-x-0 h-10 pointer-events-none"
              style={{
                background:
                  "linear-gradient(to top, hsl(var(--card, 222 17% 10%)) 0%, transparent 100%)",
              }}
            />
          </div>
        )}

        <div className="relative z-10 flex flex-col gap-4 p-5">
          {/* Header — model + price on row 1, name full-width on row 2 */}
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground truncate">
                {laptop.brand}
                {laptop.model ? ` · ${laptop.model}` : ""}
              </p>
              {displayPrice && (
                <p className="text-sm font-semibold text-foreground shrink-0 tabular-nums">
                  {displayPrice}
                </p>
              )}
            </div>
            <h3 className="font-semibold text-foreground leading-tight text-sm sm:text-base w-full">
              {laptop.name}
            </h3>
            <div className="flex items-center justify-between gap-2">
              {laptop.tier ? (
                <p className="text-xs text-muted-foreground">
                  {TIER_LABELS[laptop.tier]} tier
                </p>
              ) : (
                <span />
              )}
              {displayPrice && laptop.last_checked && (
                <p className="text-[10px] text-muted-foreground shrink-0">
                  Price as of {formatCheckedDate(laptop.last_checked)}
                </p>
              )}
            </div>
          </div>

          {/* Badges */}
          {laptop.badges.length > 0 && <BadgeList badges={laptop.badges} />}

          {/* Why this laptop — expanded by default */}
          {laptop.why_recommended && (
            <div>
              <button
                onClick={() => toggleSection("why")}
                className="flex items-center gap-1.5 text-xs text-emerald-700/80 hover:text-emerald-700 dark:text-emerald-400/80 dark:hover:text-emerald-400 transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                Why this laptop?
                {openSection === "why"
                  ? <ChevronUp className="w-3 h-3" />
                  : <ChevronDown className="w-3 h-3" />}
              </button>

              {openSection === "why" && (
                <m.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" as const }}
                  className="mt-2 p-3 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/5 border border-emerald-500/20 dark:border-emerald-500/10"
                >
                  <p className="text-xs text-emerald-900 dark:text-emerald-200/90 leading-relaxed">
                    {laptop.why_recommended}
                  </p>
                </m.div>
              )}
            </div>
          )}

          {/* Check specs — collapsible */}
          <div>
            <button
              onClick={() => toggleSection("specs")}
              className="flex items-center justify-between w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {openSection === "specs" ? (
                <span className="flex items-center gap-1">Hide specs <ChevronUp className="w-3 h-3" /></span>
              ) : (
                <span className="flex items-center gap-1">Check specs <ChevronDown className="w-3 h-3" /></span>
              )}
            </button>

            {openSection === "specs" && (
              <m.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" as const }}
                className="flex flex-col gap-1.5 mt-2"
              >
                {laptop.cpu && (
                  <SpecRow icon={<Cpu className="w-3.5 h-3.5" />} label="CPU" value={laptop.cpu} />
                )}
                {laptop.gpu && (
                  <SpecRow
                    icon={<Zap className="w-3.5 h-3.5" />}
                    label={laptop.gpu_vram_gb ? `GPU · ${laptop.gpu_vram_gb}GB` : "GPU"}
                    value={laptop.gpu}
                  />
                )}
                {laptop.ram && (
                  <SpecRow icon={<MemoryStick className="w-3.5 h-3.5" />} label="RAM" value={laptop.ram} />
                )}
                {laptop.storage && (
                  <SpecRow icon={<HardDrive className="w-3.5 h-3.5" />} label="Storage" value={laptop.storage} />
                )}
                {laptop.display && (
                  <SpecRow icon={<Monitor className="w-3.5 h-3.5" />} label="Display" value={laptop.display} />
                )}
                {laptop.weight && (
                  <SpecRow icon={<Weight className="w-3.5 h-3.5" />} label="Weight" value={laptop.weight} />
                )}
              </m.div>
            )}
          </div>

          {/* Best for these courses — collapsible */}
          {laptop.recommended_for_courses.length > 0 && (
            <div>
              <button
                onClick={() => toggleSection("bestfor")}
                className="flex items-center gap-1.5 text-xs text-violet-700/80 hover:text-violet-700 dark:text-violet-400/80 dark:hover:text-violet-400 transition-colors"
              >
                <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                Best for these courses
                {openSection === "bestfor"
                  ? <ChevronUp className="w-3 h-3" />
                  : <ChevronDown className="w-3 h-3" />}
              </button>
              {openSection === "bestfor" && (
                <m.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" as const }}
                  className="mt-2 p-3 rounded-xl bg-violet-500/10 dark:bg-violet-500/5 border border-violet-500/20 dark:border-violet-500/10"
                >
                  <div className="flex flex-wrap gap-1">
                    {laptop.recommended_for_courses.map((course) => (
                      <span
                        key={course}
                        className="text-xs px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-900 dark:text-violet-200/90 border border-violet-500/25"
                      >
                        {course}
                      </span>
                    ))}
                  </div>
                </m.div>
              )}
            </div>
          )}

          {/* Cautions & Additional Details — toggle then content */}
          {hasDetails && (
            <button
              onClick={() => toggleSection("details")}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors text-left"
            >
              {openSection === "details" ? "Hide cautions & details ↑" : "Cautions & Additional Details ↓"}
            </button>
          )}

          {openSection === "details" && (
            <m.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" as const }}
              className="flex flex-col gap-3"
            >
              {laptop.cautions && (
                <div className="flex gap-2 p-3 rounded-xl bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/20 dark:border-amber-500/10">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-900 dark:text-amber-200/90 leading-relaxed">{laptop.cautions}</p>
                </div>
              )}
              {laptop.upgrade_notes && (
                <div className="flex gap-2 p-3 rounded-xl bg-sky-500/10 dark:bg-sky-500/5 border border-sky-500/20 dark:border-sky-500/10">
                  <Info className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-sky-900 dark:text-sky-200/90 leading-relaxed">{laptop.upgrade_notes}</p>
                </div>
              )}
            </m.div>
          )}

          {/* 4-year suitability */}
          {laptop.four_year_suitability && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">4-year suitability:</span>
              <span className={`font-medium ${SUITABILITY_COLORS[laptop.four_year_suitability] ?? ""}`}>
                {FOUR_YEAR_LABELS[laptop.four_year_suitability]}
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 mt-auto pt-1">
            {laptop.affiliateCta && (
              <a
                href={buildAffiliateOutboundPath({
                  laptopId: laptop.id,
                  placement: "product_card",
                })}
                target="_blank"
                rel="sponsored noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-medium rounded-lg h-7 px-2.5 bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                {affiliateCtaLabel(laptop.affiliateCta.sourceKey)}
              </a>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCompareToggle(laptop)}
              className={`gap-1.5 text-xs border-border/60 ${isInCompare ? "border-primary/50 text-primary" : ""}`}
            >
              {isInCompare ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              Compare
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleShare}
              className={`shrink-0 w-7 h-7 p-0 border-border/60 ${copied ? "text-emerald-500 border-emerald-500/40" : ""}`}
              title={copied ? "Link copied!" : "Share this laptop"}
            >
              <Share2 className="w-3.5 h-3.5" />
            </Button>
          </div>
          {laptop.affiliateCta && (
            <AffiliateCtaDetails cta={laptop.affiliateCta} />
          )}
        </div>
      </m.div>
    </LazyMotion>
  );
}

/**
 * "2026-08-07" -> "7 Aug". Pinned to an explicit locale and zone so the server
 * and client render identical text; the input carries no time component, so
 * there is nothing here that can drift between renders.
 */
function formatCheckedDate(value: string): string {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  });
}

function SpecRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2 text-xs min-w-0">
      <span className="text-muted-foreground shrink-0 mt-0.5">{icon}</span>
      <span className="text-muted-foreground shrink-0 w-[4.5rem]">{label}</span>
      <span className="font-medium text-foreground break-words min-w-0">{value}</span>
    </div>
  );
}
