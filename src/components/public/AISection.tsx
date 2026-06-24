"use client";

import { useRef } from "react";
import { LazyMotion, domAnimation, m, useMotionValue, useAnimationFrame } from "framer-motion";
import {
  Sparkles,
  Layers,
  Film,
  Cpu,
  Gamepad2,
  BrainCircuit,
  Code2,
  Database,
  Smartphone,
  ShieldCheck,
  Cloud,
  Briefcase,
  TrendingUp,
  BarChart3,
  Megaphone,
  Boxes,
  Package,
  type LucideIcon,
} from "lucide-react";
import type { DomainConfig, LandscapeDiscipline, LandscapeIconName } from "@/lib/domains";

// Maps the icon names used in domains.ts landscape config to their components.
const ICONS: Record<LandscapeIconName, LucideIcon> = {
  Sparkles,
  Layers,
  Film,
  Cpu,
  Gamepad2,
  BrainCircuit,
  Code2,
  Database,
  Smartphone,
  ShieldCheck,
  Cloud,
  Briefcase,
  TrendingUp,
  BarChart3,
  Megaphone,
  Boxes,
  Package,
};

const HORIZON_STYLES: Record<string, string> = {
  "Moderate":    "text-muted-foreground",
  "Significant": "text-sky-600 dark:text-sky-400",
  "Very High":   "text-amber-600 dark:text-amber-400",
  "Critical":    "text-rose-600 dark:text-rose-400",
};

function DisciplineCard({ item }: { item: LandscapeDiscipline }) {
  const Icon = ICONS[item.icon];
  return (
    <div className="glass-card rounded-2xl border p-8 flex flex-col h-full gap-6">
      <Icon className={`w-7 h-7 shrink-0 ${item.iconClass}`} />
      <div className="space-y-1.5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold text-foreground leading-snug flex-1">
            {item.discipline}
          </h3>
          <span className={`text-xs font-semibold shrink-0 mt-0.5 ${HORIZON_STYLES[item.horizon] ?? ""}`}>
            {item.horizon}
          </span>
        </div>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed flex-1">{item.shift}</p>
    </div>
  );
}

function MarqueeTrack({ disciplines }: { disciplines: LandscapeDiscipline[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const paused = useRef(false);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartMotionX = useRef(0);

  useAnimationFrame((_, delta) => {
    if (paused.current || !trackRef.current) return;
    const halfWidth = trackRef.current.scrollWidth / 2;
    const next = x.get() - delta * 0.042;
    x.set(next <= -halfWidth ? 0 : next);
  });

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isDragging.current = true;
    paused.current = true;
    dragStartX.current = e.clientX;
    dragStartMotionX.current = x.get();
    e.currentTarget.setPointerCapture(e.pointerId);
    document.body.style.cursor = "grabbing";
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    x.set(dragStartMotionX.current + (e.clientX - dragStartX.current));
  };

  const onPointerUp = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (trackRef.current) {
      const halfWidth = trackRef.current.scrollWidth / 2;
      let cur = x.get() % halfWidth;
      if (cur > 0) cur -= halfWidth;
      x.set(cur);
    }
    paused.current = false;
    document.body.style.cursor = "";
  };

  return (
    <div
      className="overflow-hidden cursor-grab select-none"
      onMouseEnter={() => { if (!isDragging.current) paused.current = true; }}
      onMouseLeave={() => { if (!isDragging.current) paused.current = false; }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <m.div ref={trackRef} className="flex gap-4 py-2 px-1" style={{ x }}>
        {[...disciplines, ...disciplines].map((item, i) => (
          <div key={i} className="shrink-0 w-[320px] aspect-[3/4]">
            <DisciplineCard item={item} />
          </div>
        ))}
      </m.div>
    </div>
  );
}

export function AISection({ landscape }: { landscape: DomainConfig["landscape"] }) {
  return (
    <LazyMotion features={domAnimation}>
      <section className="py-14 w-full">
        <div className="px-4 max-w-4xl mx-auto mb-8">
          <p className="text-xs font-medium text-primary mb-2 uppercase tracking-wider">
            {landscape.eyebrow}
          </p>
          <h2 className="text-2xl font-bold text-foreground mb-3">
            {landscape.heading}
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-2xl">
            {landscape.intro}
          </p>
        </div>

        {/* Desktop: auto-scrolling marquee, draggable */}
        <div className="hidden md:block">
          <MarqueeTrack disciplines={landscape.disciplines} />
        </div>

        {/* Mobile: swipe carousel — 90% card width so next card peeks */}
        <div
          className="md:hidden flex gap-4 overflow-x-auto pb-3 px-4 snap-x snap-mandatory"
          style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" } as React.CSSProperties}
        >
          {landscape.disciplines.map((item) => (
            <div key={item.discipline} className="snap-start shrink-0 w-[85%] aspect-[3/4]">
              <DisciplineCard item={item} />
            </div>
          ))}
        </div>

        <div className="px-4 max-w-4xl mx-auto mt-8">
          <div className="p-5 rounded-xl border border-primary/20 bg-primary/5">
            <p className="text-sm text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground">A note on planning: </span>
              {landscape.planningNote}
            </p>
          </div>
        </div>
      </section>
    </LazyMotion>
  );
}
