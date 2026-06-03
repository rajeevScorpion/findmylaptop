"use client";

import { ExternalLink } from "lucide-react";
import { TIER_LABELS } from "@/lib/constants";
import type { Laptop } from "@/lib/types";

const TIER_COLORS: Record<string, string> = {
  budget:   "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400",
  value:    "bg-sky-500/10 border-sky-500/30 text-sky-700 dark:text-sky-400",
  balanced: "bg-violet-500/10 border-violet-500/30 text-violet-700 dark:text-violet-400",
  advanced: "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400",
  premium:  "bg-pink-500/10 border-pink-500/30 text-pink-700 dark:text-pink-400",
};

interface LaptopMiniCardProps {
  laptop: Laptop;
}

export function LaptopMiniCard({ laptop }: LaptopMiniCardProps) {
  return (
    <div className="glass-card rounded-xl border p-2.5 flex gap-2.5 items-start">
      {laptop.image_url ? (
        <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-white/5 border border-border/30 flex items-center justify-center">
          <img
            src={laptop.image_url}
            alt={laptop.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      ) : (
        <div className="w-14 h-14 rounded-lg shrink-0 bg-muted border border-border/30 flex items-center justify-center">
          <span className="text-xs text-muted-foreground font-semibold">
            {(laptop.brand ?? "?").slice(0, 2).toUpperCase()}
          </span>
        </div>
      )}

      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-xs font-medium text-foreground leading-tight line-clamp-2">
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
          {laptop.price_label && (
            <span className="text-[10px] font-semibold text-foreground/80">
              {laptop.price_label}
            </span>
          )}
        </div>
        <a
          href={laptop.amazon_affiliate_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[10px] font-medium text-primary hover:text-primary/80 transition-colors"
        >
          <ExternalLink className="w-2.5 h-2.5" />
          Buy on Amazon
        </a>
      </div>
    </div>
  );
}
