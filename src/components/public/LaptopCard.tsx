"use client";

import { useState } from "react";
import { ExternalLink, Cpu, Zap, MemoryStick, HardDrive, Monitor, Weight, CheckCircle2, AlertCircle, Info, Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BadgeList } from "./BadgeList";
import type { RecommendationResult } from "@/lib/types";
import { FOUR_YEAR_LABELS, TIER_LABELS } from "@/lib/constants";

interface LaptopCardProps {
  laptop: RecommendationResult;
  onCompareToggle: (laptop: RecommendationResult) => void;
  isInCompare: boolean;
}

const SUITABILITY_COLORS: Record<string, string> = {
  excellent: "text-emerald-400",
  strong: "text-sky-400",
  good: "text-amber-400",
  basic: "text-muted-foreground",
};

export function LaptopCard({ laptop, onCompareToggle, isInCompare }: LaptopCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="laptop-card glass-card rounded-2xl p-5 flex flex-col gap-4 border">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground mb-0.5">
            {laptop.brand}{laptop.model ? ` · ${laptop.model}` : ""}
          </p>
          <h3 className="font-semibold text-foreground leading-tight text-sm sm:text-base">
            {laptop.name}
          </h3>
          {laptop.tier && (
            <span className="text-xs text-muted-foreground">
              {TIER_LABELS[laptop.tier]} tier
            </span>
          )}
        </div>
        {laptop.price_label && (
          <div className="text-right shrink-0">
            <p className="font-bold text-foreground text-lg leading-none">
              {laptop.price_label}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">approx.</p>
          </div>
        )}
      </div>

      {/* Badges */}
      {laptop.badges.length > 0 && (
        <BadgeList badges={laptop.badges} />
      )}

      {/* Key specs grid */}
      <div className="grid grid-cols-2 gap-2">
        {laptop.cpu && (
          <SpecItem icon={<Cpu className="w-3.5 h-3.5" />} label="CPU" value={laptop.cpu} />
        )}
        {laptop.gpu && (
          <SpecItem icon={<Zap className="w-3.5 h-3.5" />} label={`GPU${laptop.gpu_vram_gb ? ` · ${laptop.gpu_vram_gb}GB` : ""}`} value={laptop.gpu} />
        )}
        {laptop.ram && (
          <SpecItem icon={<MemoryStick className="w-3.5 h-3.5" />} label="RAM" value={laptop.ram} />
        )}
        {laptop.storage && (
          <SpecItem icon={<HardDrive className="w-3.5 h-3.5" />} label="Storage" value={laptop.storage} />
        )}
        {laptop.display && (
          <SpecItem icon={<Monitor className="w-3.5 h-3.5" />} label="Display" value={laptop.display} />
        )}
        {laptop.weight && (
          <SpecItem icon={<Weight className="w-3.5 h-3.5" />} label="Weight" value={laptop.weight} />
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

      {/* Why recommended */}
      {laptop.why_recommended && (
        <div className="flex gap-2 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-xs text-emerald-300/90 leading-relaxed">
            {laptop.why_recommended}
          </p>
        </div>
      )}

      {/* Cautions — expanded */}
      {expanded && laptop.cautions && (
        <div className="flex gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300/90 leading-relaxed">
            {laptop.cautions}
          </p>
        </div>
      )}

      {/* Upgrade notes — expanded */}
      {expanded && laptop.upgrade_notes && (
        <div className="flex gap-2 p-3 rounded-xl bg-sky-500/5 border border-sky-500/10">
          <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
          <p className="text-xs text-sky-300/90 leading-relaxed">
            {laptop.upgrade_notes}
          </p>
        </div>
      )}

      {/* Best for courses — expanded */}
      {expanded && laptop.recommended_for_courses.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-1.5">Best for:</p>
          <div className="flex flex-wrap gap-1">
            {laptop.recommended_for_courses.map((course) => (
              <span key={course} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary/90 border border-primary/20">
                {course}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Toggle expand */}
      {(laptop.cautions || laptop.upgrade_notes || laptop.recommended_for_courses.length > 0) && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors text-left"
        >
          {expanded ? "Show less ↑" : "Show cautions & details ↓"}
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
          Buy on Amazon
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
  );
}

function SpecItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-1.5 min-w-0">
      <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className="text-xs font-medium text-foreground leading-tight line-clamp-2">{value}</p>
      </div>
    </div>
  );
}
