"use client";

import { useState } from "react";
import {
  Apple,
  Monitor,
  Cpu,
  Terminal,
  MemoryStick,
  Tablet,
  TriangleAlert,
  Cloud,
  Laptop,
  Info,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import type { AdvisoryIconName, DomainConfig } from "@/lib/domains";

// Maps the icon names used in domains.ts advisory config to their components.
const ICONS: Record<AdvisoryIconName, LucideIcon> = {
  Apple,
  Monitor,
  Cpu,
  Terminal,
  MemoryStick,
  Tablet,
  TriangleAlert,
  Cloud,
  Laptop,
};

// Per-domain advisory section: practical guidance about the machine a reader
// may already own (or the common shortcut they're weighing). Content is
// config-driven from domains.ts so each domain gets its own topic.
//
// On mobile each card collapses to its title (tap to expand) to keep the
// section scannable; on md+ every card is always expanded and the toggle is
// inert (the chevron is hidden and the heading isn't interactive).
export function AdvisorySection({ advisory }: { advisory: DomainConfig["advisory"] }) {
  const [open, setOpen] = useState<Set<number>>(new Set());

  const toggle = (i: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <section className="px-4 py-10 max-w-3xl mx-auto w-full">
      <div className="glass-card rounded-2xl border p-6 space-y-5">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <h2 className="text-base font-semibold text-foreground mb-1">
              {advisory.heading}
            </h2>
            <p className="text-sm text-muted-foreground">{advisory.subheading}</p>
          </div>
        </div>

        <div className="space-y-4">
          {advisory.cards.map((card, i) => {
            const Icon = ICONS[card.icon];
            const isOpen = open.has(i);
            return (
              <div key={card.title} className="flex gap-3">
                <Icon className={`w-4 h-4 shrink-0 mt-1 ${card.iconClass}`} />
                <div className="flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => toggle(i)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-2 text-left md:pointer-events-none md:cursor-default"
                  >
                    <span className="text-sm font-medium text-foreground">
                      {card.title}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform md:hidden ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  <div className={`${isOpen ? "block" : "hidden"} md:block`}>
                    {card.paragraphs.map((para, p) => (
                      <p
                        key={p}
                        className="text-sm text-muted-foreground leading-relaxed mt-2"
                      >
                        {para}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-3 rounded-xl bg-muted/30 border border-border/30">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="font-medium text-foreground">Practical advice: </span>
            {advisory.footer}
          </p>
        </div>
      </div>
    </section>
  );
}
