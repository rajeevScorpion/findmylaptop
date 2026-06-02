"use client";

import { useState } from "react";
import { LazyMotion, domAnimation, m } from "framer-motion";
import {
  ExternalLink, Cpu, Zap, MemoryStick, HardDrive,
  Monitor, Weight, CheckCircle2, AlertCircle, Info,
  Plus, Check, ChevronDown, ChevronUp, GraduationCap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BadgeList } from "./BadgeList";
import type { RecommendationResult } from "@/lib/types";
import { FOUR_YEAR_LABELS, TIER_LABELS } from "@/lib/constants";

interface LaptopCardProps {
  laptop: RecommendationResult;
  onCompareToggle: (laptop: RecommendationResult) => void;
  isInCompare: boolean;
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

export function LaptopCard({ laptop, onCompareToggle, isInCompare }: LaptopCardProps) {
  const [showSpecs, setShowSpecs]     = useState(false);
  const [showWhy, setShowWhy]         = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showBestFor, setShowBestFor] = useState(false);

  const glowColor = TIER_GLOW[laptop.tier ?? ""] ?? "#a78bfa";
  const hasDetails = laptop.cautions || laptop.upgrade_notes;

  return (
    <LazyMotion features={domAnimation}>
      <m.div
        className="laptop-card glass-card rounded-2xl border overflow-hidden flex flex-col group relative"
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
              {laptop.price_label && (
                <div className="text-right shrink-0">
                  <span className="font-bold text-foreground text-base leading-none">
                    {laptop.price_label}
                  </span>
                  <span className="text-xs text-muted-foreground ml-1">approx.</span>
                </div>
              )}
            </div>
            <h3 className="font-semibold text-foreground leading-tight text-sm sm:text-base w-full">
              {laptop.name}
            </h3>
            {laptop.tier && (
              <p className="text-xs text-muted-foreground">
                {TIER_LABELS[laptop.tier]} tier
              </p>
            )}
          </div>

          {/* Badges */}
          {laptop.badges.length > 0 && <BadgeList badges={laptop.badges} />}

          {/* Specs — collapsible */}
          <div>
            <button
              onClick={() => setShowSpecs(!showSpecs)}
              className="flex items-center justify-between w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showSpecs ? (
                <span className="flex items-center gap-1">Hide specs <ChevronUp className="w-3 h-3" /></span>
              ) : (
                <span className="flex items-center gap-1">Check specs <ChevronDown className="w-3 h-3" /></span>
              )}
            </button>

            {showSpecs && (
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

          {/* 4-year suitability */}
          {laptop.four_year_suitability && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">4-year suitability:</span>
              <span className={`font-medium ${SUITABILITY_COLORS[laptop.four_year_suitability] ?? ""}`}>
                {FOUR_YEAR_LABELS[laptop.four_year_suitability]}
              </span>
            </div>
          )}

          {/* Why this laptop — collapsed by default */}
          {laptop.why_recommended && (
            <div>
              <button
                onClick={() => setShowWhy(!showWhy)}
                className="flex items-center gap-1.5 text-xs text-emerald-700/80 hover:text-emerald-700 dark:text-emerald-400/80 dark:hover:text-emerald-400 transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                Why this laptop?
                {showWhy
                  ? <ChevronUp className="w-3 h-3" />
                  : <ChevronDown className="w-3 h-3" />}
              </button>

              {showWhy && (
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

          {/* Cautions + upgrade notes + courses */}
          {/* Best for — own collapsible */}
          {laptop.recommended_for_courses.length > 0 && (
            <div>
              <button
                onClick={() => setShowBestFor(!showBestFor)}
                className="flex items-center gap-1.5 text-xs text-violet-700/80 hover:text-violet-700 dark:text-violet-400/80 dark:hover:text-violet-400 transition-colors"
              >
                <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                Best for these courses
                {showBestFor
                  ? <ChevronUp className="w-3 h-3" />
                  : <ChevronDown className="w-3 h-3" />}
              </button>
              {showBestFor && (
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

          {/* Cautions + upgrade notes */}
          {showDetails && (
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

          {/* Toggle cautions / details */}
          {hasDetails && (
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors text-left"
            >
              {showDetails ? "Show less ↑" : "Show cautions & details ↓"}
            </button>
          )}

          {/* Actions */}
          <div className="flex gap-2 mt-auto pt-1">
            <a
              href={laptop.amazon_affiliate_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-medium rounded-lg h-7 px-2.5 bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              See on Amazon
            </a>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCompareToggle(laptop)}
              className={`gap-1.5 text-xs border-border/60 ${isInCompare ? "border-primary/50 text-primary" : ""}`}
            >
              {isInCompare ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              Compare
            </Button>
          </div>
        </div>
      </m.div>
    </LazyMotion>
  );
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
    <div className="flex items-center gap-2 text-xs min-w-0">
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <span className="text-muted-foreground shrink-0 w-[4.5rem]">{label}</span>
      <span className="font-medium text-foreground truncate">{value}</span>
    </div>
  );
}
