"use client";

import { LazyMotion, domAnimation, m } from "framer-motion";
import { Cpu, Zap, MemoryStick, HardDrive, Monitor, Thermometer, Wrench, type LucideIcon } from "lucide-react";

type ExplainerItem = {
  Icon: LucideIcon;
  id: string;
  title: string;
  subtitle: string;
  iconClass: string;
  glowColor: string;
  bullets: string[];
};

const EXPLAINERS: ExplainerItem[] = [
  {
    Icon: Cpu,
    id: "cpu",
    title: "CPU",
    subtitle: "The Brain",
    iconClass: "text-violet-400",
    glowColor: "#a78bfa",
    bullets: [
      "Runs your software, processes files, handles multitasking",
      "Intel Core i7/i9 H-series or AMD Ryzen 7/9 HS/HX for design work",
      "H-class only — U-class chips throttle under sustained creative load",
      "Faster CPU = quicker 3D bakes, video exports, simulation calculations",
      "More cores help when running Blender, Photoshop, and AI tools together",
    ],
  },
  {
    Icon: Zap,
    id: "gpu",
    title: "GPU",
    subtitle: "The Visual Engine",
    iconClass: "text-amber-400",
    glowColor: "#fbbf24",
    bullets: [
      "Powers 3D rendering, AI generation, real-time previews, video processing",
      "NVIDIA RTX 4050 (6GB VRAM) is the practical minimum",
      "RTX 4060 (8GB VRAM) strongly preferred for 3D, animation, game, or AI",
      "VRAM is the most critical figure — aim for 6–8GB minimum",
      "CUDA unlocks Stable Diffusion, Blender CUDA, DaVinci, and local AI models",
    ],
  },
  {
    Icon: MemoryStick,
    id: "ram",
    title: "RAM",
    subtitle: "Your Working Table",
    iconClass: "text-sky-400",
    glowColor: "#38bdf8",
    bullets: [
      "Holds all active apps, open files, and background processes",
      "16GB is the floor — 24–32GB strongly preferred",
      "3D, AI tools, and large file workflows exhaust 16GB quickly",
      "Upgradeable RAM extends useful laptop life at low cost (~₹4,000–6,000)",
      "Soldered RAM caps you permanently at what the laptop ships with",
    ],
  },
  {
    Icon: HardDrive,
    id: "ssd",
    title: "SSD",
    subtitle: "Speed and Space",
    iconClass: "text-violet-400",
    glowColor: "#a78bfa",
    bullets: [
      "Faster SSD = quicker boot, file saves, and 3D asset loading",
      "512GB is a bare minimum — assets and renders fill it fast",
      "1TB NVMe is the recommended starting point",
      "NVMe (M.2) SSDs are significantly faster than SATA drives",
      "A free M.2 slot lets you add storage later without replacing the drive",
    ],
  },
  {
    Icon: Monitor,
    id: "display",
    title: "Display",
    subtitle: "Colour and Clarity",
    iconClass: "text-emerald-400",
    glowColor: "#34d399",
    bullets: [
      "Colour accuracy is non-negotiable for any design discipline",
      "Minimum: 100% sRGB coverage — DCI-P3 is a bonus for video/photo",
      "15–16 inch screen is more comfortable for extended creative work",
      "144Hz+ matters for game design and animation; less so for 2D and UI",
      "Matte panel reduces glare under varied studio lighting",
    ],
  },
  {
    Icon: Thermometer,
    id: "thermals",
    title: "Thermals",
    subtitle: "Performance Under Load",
    iconClass: "text-rose-400",
    glowColor: "#f87171",
    bullets: [
      "Thin laptops throttle their GPU to prevent overheating",
      "Same RTX 4060 can run 20–30% slower in a slim chassis vs. a proper build",
      "Heavier chassis = better cooling = consistent sustained performance",
      "Always check thermal reviews — benchmark peaks do not tell the full story",
      "Critical if you render, animate, or run AI workflows for hours at a time",
    ],
  },
  {
    Icon: Wrench,
    id: "upgrade",
    title: "Upgradability",
    subtitle: "Extending Your Laptop's Life",
    iconClass: "text-orange-400",
    glowColor: "#fb923c",
    bullets: [
      "Start at 16GB RAM, upgrade to 32GB a year later for ~₹5,000",
      "A free M.2 slot lets you expand storage without opening the main drive",
      "Upgradeable laptop beats a sealed one with the same specs — every time",
      "Ask before buying: is RAM soldered? How many M.2 slots are free?",
      "Upgradeability is the single biggest factor in 4-year value",
    ],
  },
];

const container = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.07 },
  },
};

const cardVariant = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: "easeOut" as const },
  },
};

export function HardwareExplainer() {
  return (
    <LazyMotion features={domAnimation}>
      <section id="explainer" className="py-20 w-full">
        <m.div
          className="px-4 mb-14 text-center max-w-7xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: "easeOut" as const }}
        >
          <h2 className="text-3xl font-bold text-foreground mb-3">
            Understanding laptop specs
          </h2>
          <p className="text-muted-foreground text-sm max-w-xl mx-auto">
            Not sure what CPU, VRAM, or thermals mean? Here's everything you need
            to know — in plain language.
          </p>
        </m.div>

        <m.div
          className="flex flex-nowrap overflow-x-auto snap-x snap-mandatory gap-4 px-4 [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-2 sm:overflow-visible sm:max-w-7xl sm:mx-auto sm:px-4 lg:grid-cols-4"
          style={{ scrollbarWidth: "none" }}
          variants={container}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
        >
          {EXPLAINERS.map((item) => (
            <ExplainerCard key={item.id} item={item} />
          ))}
        </m.div>
      </section>
    </LazyMotion>
  );
}

function ExplainerCard({ item }: { item: ExplainerItem }) {
  return (
    <m.div
      variants={cardVariant}
      whileHover={{ y: -6, scale: 1.015 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      className="relative glass-card rounded-2xl border overflow-hidden flex flex-col gap-5 p-8 cursor-default snap-start shrink-0 w-[78vw] sm:w-auto sm:shrink"
    >
      {/* Radial glow */}
      <div
        className="absolute -top-8 -left-8 w-40 h-40 rounded-full blur-3xl pointer-events-none opacity-20"
        style={{ background: item.glowColor }}
      />
      <div
        className="absolute bottom-0 right-0 w-28 h-28 rounded-full blur-2xl pointer-events-none opacity-10"
        style={{ background: item.glowColor }}
      />

      {/* Icon */}
      <div
        className="relative z-10 w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${item.glowColor}18`, border: `1px solid ${item.glowColor}30` }}
      >
        <item.Icon className={`w-6 h-6 ${item.iconClass}`} />
      </div>

      {/* Title */}
      <div className="relative z-10 space-y-0.5">
        <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground">
          {item.subtitle}
        </p>
        <h3 className="text-lg font-bold text-foreground">{item.title}</h3>
      </div>

      {/* Divider */}
      <div
        className="relative z-10 h-px w-full"
        style={{ background: `linear-gradient(to right, ${item.glowColor}40, transparent)` }}
      />

      {/* Bullets */}
      <ul className="relative z-10 flex flex-col gap-2">
        {item.bullets.map((point, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground leading-snug">
            <span
              className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: item.glowColor }}
            />
            {point}
          </li>
        ))}
      </ul>
    </m.div>
  );
}
