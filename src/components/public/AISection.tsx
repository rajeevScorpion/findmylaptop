"use client";

import { useRef } from "react";
import { LazyMotion, domAnimation, m, useMotionValue, useAnimationFrame } from "framer-motion";
import { Sparkles, Layers, Film, Cpu, Gamepad2, BrainCircuit } from "lucide-react";

const DISCIPLINES = [
  {
    icon: Sparkles,
    iconClass: "text-amber-500 dark:text-amber-400",
    discipline: "Communication, Fashion, Brand",
    shift: "AI-assisted ideation, text-to-image generation, mockup creation, and brand toolkit automation are entering design workflows. 2D-heavy work remains manageable on mid-range hardware, but generative tools increasingly benefit from a capable GPU.",
    horizon: "Moderate",
  },
  {
    icon: Layers,
    iconClass: "text-sky-500 dark:text-sky-400",
    discipline: "Product, Interaction, Interior",
    shift: "3D visualisation, parametric modelling, simulation tools, and real-time rendering previews are increasingly used across these disciplines. Expect Blender, Rhino, or SketchUp to be part of the toolkit within the first year.",
    horizon: "Significant",
  },
  {
    icon: Film,
    iconClass: "text-violet-500 dark:text-violet-400",
    discipline: "Animation, Film, Motion",
    shift: "GPU rendering (Cycles, V-Ray, Arnold), AI-assisted in-betweening, motion capture processing, and video grading workflows demand heavy compute. 8GB+ VRAM and fast multi-core CPUs are not optional for sustained use.",
    horizon: "Very High",
  },
  {
    icon: Gamepad2,
    iconClass: "text-emerald-500 dark:text-emerald-400",
    discipline: "Game Art, Game Design, Programming",
    shift: "Real-time rendering engines (Unreal 5, Unity), procedural asset creation, shader development, and live game testing are the core workflow. RTX 4060 is a practical minimum; 4070 is strongly preferred for Unreal 5 work.",
    horizon: "Very High",
  },
  {
    icon: Cpu,
    iconClass: "text-rose-500 dark:text-rose-400",
    discipline: "Transportation & Mobility Design",
    shift: "Surfacing, photorealistic rendering, fluid simulation, and structural analysis tools are computationally intensive. These disciplines sit at the high end of hardware requirements — plan for the highest practical GPU tier in your budget.",
    horizon: "Very High",
  },
  {
    icon: BrainCircuit,
    iconClass: "text-indigo-500 dark:text-indigo-400",
    discipline: "AI in Creative Practice",
    shift: "Running local diffusion models, fine-tuning workflows, generative design scripting, and GPU-accelerated inference require 8GB+ VRAM as a baseline. This discipline has the highest compute requirements of any design course.",
    horizon: "Critical",
  },
];

const HORIZON_STYLES: Record<string, string> = {
  "Moderate":    "text-muted-foreground",
  "Significant": "text-sky-600 dark:text-sky-400",
  "Very High":   "text-amber-600 dark:text-amber-400",
  "Critical":    "text-rose-600 dark:text-rose-400",
};

type Discipline = typeof DISCIPLINES[0];

function DisciplineCard({ item }: { item: Discipline }) {
  const Icon = item.icon;
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

function MarqueeTrack() {
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
        {[...DISCIPLINES, ...DISCIPLINES].map((item, i) => (
          <div key={i} className="shrink-0 w-[320px] aspect-[3/4]">
            <DisciplineCard item={item} />
          </div>
        ))}
      </m.div>
    </div>
  );
}

export function AISection() {
  return (
    <LazyMotion features={domAnimation}>
      <section className="py-14 w-full">
        <div className="px-4 max-w-4xl mx-auto mb-8">
          <p className="text-xs font-medium text-primary mb-2 uppercase tracking-wider">
            The changing landscape
          </p>
          <h2 className="text-2xl font-bold text-foreground mb-3">
            Design education is computationally evolving
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-2xl">
            Design students are no longer using laptops only for documentation, browsing, and basic
            layout work. Across disciplines, AI-assisted ideation, 3D visualisation, video
            workflows, simulation, and real-time rendering are becoming part of creative education.
            The right laptop should be chosen not only for the first semester, but for the full
            design-learning journey.
          </p>
        </div>

        {/* Desktop: auto-scrolling marquee, draggable */}
        <div className="hidden md:block">
          <MarqueeTrack />
        </div>

        {/* Mobile: swipe carousel — 90% card width so next card peeks */}
        <div
          className="md:hidden flex gap-4 overflow-x-auto pb-3 px-4 snap-x snap-mandatory"
          style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" } as React.CSSProperties}
        >
          {DISCIPLINES.map((item) => (
            <div key={item.discipline} className="snap-start shrink-0 w-[85%] aspect-[3/4]">
              <DisciplineCard item={item} />
            </div>
          ))}
        </div>

        <div className="px-4 max-w-4xl mx-auto mt-8">
          <div className="p-5 rounded-xl border border-primary/20 bg-primary/5">
            <p className="text-sm text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground">A note on planning: </span>
              Students do not always need the most expensive laptop. But they should buy with a
              3–4 year academic journey in mind. A well-chosen ₹90,000 laptop with 16GB RAM,
              an RTX 4060, and an upgradeable slot will serve most students better than a
              ₹1,20,000 thin laptop with soldered 16GB RAM and an RTX 4050.
            </p>
          </div>
        </div>
      </section>
    </LazyMotion>
  );
}
