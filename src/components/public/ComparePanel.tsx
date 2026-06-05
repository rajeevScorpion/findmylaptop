"use client";

import { useState } from "react";
import {
  X, ExternalLink, Cpu, Zap, MemoryStick, HardDrive,
  Monitor, Weight, Shield, AlertCircle, ChevronDown, ChevronUp,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { RecommendationResult } from "@/lib/types";
import { FOUR_YEAR_LABELS, TIER_LABELS } from "@/lib/constants";

interface ComparePanelProps {
  laptops: RecommendationResult[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRemove: (id: string) => void;
  onClearAll: () => void;
}

type Sections = { specs: boolean; courses: boolean; notes: boolean };

const TIER_GLOW: Record<string, string> = {
  budget: "#34d399", value: "#38bdf8", balanced: "#a78bfa",
  advanced: "#fbbf24", premium: "#f472b6",
};

const SUITABILITY_COLORS: Record<string, string> = {
  excellent: "text-emerald-400",
  strong:    "text-sky-400",
  good:      "text-amber-400",
  basic:     "text-muted-foreground",
};

export function ComparePanel({ laptops, open, onOpenChange, onRemove, onClearAll }: ComparePanelProps) {
  const visible = laptops.slice(0, 3);
  const [sections, setSections] = useState<Sections>({ specs: true, courses: false, notes: false });

  const toggle = (key: keyof Sections) =>
    setSections((s) => ({ ...s, [key]: !s[key] }));

  return (
    <>
      {/* Trigger bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 glass-card border-t border-border/40 backdrop-blur-md">
        <span className="text-sm font-medium text-foreground">
          {laptops.length} laptop{laptops.length !== 1 ? "s" : ""} selected
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="ghost" onClick={onClearAll} className="text-xs text-muted-foreground hover:text-foreground">
            Clear
          </Button>
          <div className="relative">
            <span className="absolute inset-1 rounded-md animate-ping bg-primary/20 pointer-events-none" />
            <Button size="sm" onClick={() => onOpenChange(true)} className="relative gap-1.5 bg-primary text-primary-foreground hover:opacity-90">
              Compare now
            </Button>
          </div>
        </div>
      </div>

      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="gap-0 bg-background border-t border-border/60 p-0 flex flex-col"
          style={{ height: "50vh", maxHeight: "50vh" }}
        >
          {/* Minimal header */}
          <div className="shrink-0 flex items-center justify-between border-b border-border/40 px-4 py-2.5">
            <SheetTitle className="text-foreground text-sm font-semibold">
              Compare Laptops
            </SheetTitle>
            <button
              onClick={() => onOpenChange(false)}
              className="w-6 h-6 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              aria-label="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Horizontally + vertically scrollable body */}
          <div className="flex-1 min-h-0 overflow-auto">
            <div className="flex gap-3 w-max px-4 py-3">
              {visible.map((laptop) => (
                <LaptopCompareCard
                  key={laptop.id}
                  laptop={laptop}
                  onRemove={onRemove}
                  sections={sections}
                  onToggleSection={toggle}
                />
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function SectionHeader({
  label,
  active,
  onToggle,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`flex items-center justify-between w-full px-2 py-1.5 rounded-lg transition-colors group mt-1 ${
        active
          ? "text-muted-foreground hover:text-foreground"
          : "bg-primary/10 border border-primary/20 text-primary hover:bg-primary/15"
      }`}
    >
      <span className="text-[10px] font-semibold uppercase tracking-widest">
        {label}
      </span>
      {active
        ? <ChevronUp className="w-3 h-3 opacity-50 group-hover:opacity-100" />
        : <ChevronDown className="w-3 h-3 opacity-80" />}
    </button>
  );
}

function LaptopCompareCard({
  laptop,
  onRemove,
  sections,
  onToggleSection,
}: {
  laptop: RecommendationResult;
  onRemove: (id: string) => void;
  sections: Sections;
  onToggleSection: (key: keyof Sections) => void;
}) {
  const glowColor = TIER_GLOW[laptop.tier ?? ""] ?? "#a78bfa";

  return (
    <div
      className="shrink-0 w-[calc((100vw-3rem)/2)] md:w-[calc((100vw-4rem)/3)] max-w-[420px] glass-card rounded-2xl border overflow-hidden flex flex-col"
      style={{ borderColor: `${glowColor}35`, boxShadow: `0 0 24px -10px ${glowColor}30` }}
    >
      <div className="flex flex-col p-3 min-w-0 gap-2 overflow-y-auto">
        {/* Name + price */}
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">
            {laptop.brand}{laptop.model ? ` · ${laptop.model}` : ""}
          </p>
          <h3 className="font-semibold text-sm text-foreground leading-snug break-words">
            {laptop.name}
          </h3>
          <div className="flex items-baseline gap-2 mt-0.5">
            {laptop.price_label && (
              <span className="text-base font-bold text-foreground">{laptop.price_label}</span>
            )}
            {laptop.tier && (
              <span className="text-xs text-muted-foreground">{TIER_LABELS[laptop.tier]}</span>
            )}
          </div>
        </div>

        {/* Remove */}
        <button
          onClick={() => onRemove(laptop.id)}
          className="flex items-center justify-center gap-1.5 w-full py-1 rounded-lg text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 hover:border-rose-500/40 transition-all"
        >
          <X className="w-3 h-3" />
          Remove
        </button>

        {/* ── Specs section ── */}
        <div className="border-t border-border/25">
          <SectionHeader label="Specs" active={sections.specs} onToggle={() => onToggleSection("specs")} />
          {sections.specs && (
            <div className="flex flex-col">
              {laptop.cpu && <SpecRow icon={<Cpu className="w-3 h-3" />} label="CPU" value={laptop.cpu} />}
              {laptop.gpu && (
                <SpecRow
                  icon={<Zap className="w-3 h-3" />}
                  label={laptop.gpu_vram_gb ? `GPU · ${laptop.gpu_vram_gb}GB` : "GPU"}
                  value={laptop.gpu}
                />
              )}
              {laptop.ram && <SpecRow icon={<MemoryStick className="w-3 h-3" />} label="RAM" value={laptop.ram} />}
              {laptop.storage && <SpecRow icon={<HardDrive className="w-3 h-3" />} label="Storage" value={laptop.storage} />}
              {laptop.display && <SpecRow icon={<Monitor className="w-3 h-3" />} label="Display" value={laptop.display} />}
              {laptop.weight && <SpecRow icon={<Weight className="w-3 h-3" />} label="Weight" value={laptop.weight} />}
              {laptop.four_year_suitability && (
                <SpecRow
                  icon={<Shield className="w-3 h-3" />}
                  label="4-Year"
                  value={FOUR_YEAR_LABELS[laptop.four_year_suitability]}
                  valueClass={SUITABILITY_COLORS[laptop.four_year_suitability]}
                />
              )}
            </div>
          )}
        </div>

        {/* ── Best for section ── */}
        {laptop.recommended_for_courses.length > 0 && (
          <div className="border-t border-border/25">
            <SectionHeader label="Best for" active={sections.courses} onToggle={() => onToggleSection("courses")} />
            {sections.courses && (
              <div className="flex flex-wrap gap-1 pb-1">
                {laptop.recommended_for_courses.map((c) => (
                  <span key={c} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary/80 border border-primary/20">
                    {c}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Notes section ── */}
        {laptop.cautions && (
          <div className="border-t border-border/25">
            <SectionHeader label="Notes" active={sections.notes} onToggle={() => onToggleSection("notes")} />
            {sections.notes && (
              <div className="flex gap-2 p-2 rounded-xl bg-amber-500/5 border border-amber-500/15 mb-1">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300/80 leading-relaxed">{laptop.cautions}</p>
              </div>
            )}
          </div>
        )}

        {/* Buy */}
        <a
          href={laptop.amazon_affiliate_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity mt-1"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Buy on Amazon
        </a>
      </div>
    </div>
  );
}

function SpecRow({ icon, label, value, valueClass }: { icon: React.ReactNode; label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex gap-2 py-1.5 border-b border-border/10 last:border-0 min-w-0">
      <span className="flex items-center gap-1 text-muted-foreground text-xs w-5 sm:w-16 shrink-0">
        {icon}
        <span className="hidden sm:inline">{label}</span>
      </span>
      <span className={`text-xs font-medium text-foreground leading-snug min-w-0 break-words ${valueClass ?? ""}`}>{value}</span>
    </div>
  );
}
