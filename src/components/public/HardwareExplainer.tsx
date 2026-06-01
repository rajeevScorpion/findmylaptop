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
  body: string;
};

const EXPLAINERS: ExplainerItem[] = [
  {
    Icon: Cpu,
    id: "cpu",
    title: "CPU",
    subtitle: "The Brain",
    iconClass: "text-violet-400",
    glowColor: "#a78bfa",
    body: "The CPU handles all computation — running your software, processing files, and managing multitasking. For design students, a modern Intel Core i7/i9 H-series or AMD Ryzen 7/9 HS/HX gives smooth Photoshop, Illustrator, and Figma performance. A stronger CPU also speeds up 3D rendering bakes, video exports, and simulation calculations. Look for H-class (not U-class) for real sustained performance under load.",
  },
  {
    Icon: Zap,
    id: "gpu",
    title: "GPU",
    subtitle: "The Visual Engine",
    iconClass: "text-amber-400",
    glowColor: "#fbbf24",
    body: "The GPU powers 3D rendering, video processing, AI image generation, real-time previews in Blender and Unreal Engine, and simulations. For most design courses, an NVIDIA RTX 4050 (6GB VRAM) is a practical minimum. RTX 4060 (8GB) is strongly preferred for 3D-heavy, game, animation, or AI workflows. VRAM is the most critical figure — 6–8GB is the practical minimum for modern creative workflows.",
  },
  {
    Icon: MemoryStick,
    id: "ram",
    title: "RAM",
    subtitle: "Your Working Table",
    iconClass: "text-sky-400",
    glowColor: "#38bdf8",
    body: "RAM is the workspace where your laptop holds active tasks. 16GB is the minimum for design work. 24–32GB is strongly preferred for students working with 3D, multiple large files, rendering, and AI tools simultaneously. Upgradeable RAM is a significant advantage — it extends the usable life of your laptop. Soldered RAM means your laptop is capped at the RAM it ships with.",
  },
  {
    Icon: HardDrive,
    id: "ssd",
    title: "SSD",
    subtitle: "Speed and Space",
    iconClass: "text-violet-400",
    glowColor: "#a78bfa",
    body: "The SSD is your storage. A fast NVMe SSD means faster boot times, quicker file saves, and smoother 3D asset loading. 512GB is a bare minimum — assets, textures, renders, and video footage fill up fast. 1TB is the recommended starting point. An M.2 expansion slot is a practical advantage, letting you add storage later without replacing the drive.",
  },
  {
    Icon: Monitor,
    id: "display",
    title: "Display",
    subtitle: "Colour and Clarity",
    iconClass: "text-emerald-400",
    glowColor: "#34d399",
    body: "For design work, colour accuracy matters. Look for displays with 100% sRGB coverage or higher. DCI-P3 coverage is a bonus for video and photography disciplines. A 15–16 inch display is generally more comfortable for creative work. Higher refresh rates (144Hz+) are useful for game design and animation students but less critical for 2D and communication design courses.",
  },
  {
    Icon: Thermometer,
    id: "thermals",
    title: "Thermals",
    subtitle: "Performance Under Load",
    iconClass: "text-rose-400",
    glowColor: "#f87171",
    body: "Thin laptops with powerful GPUs often throttle under sustained load to prevent overheating. This means the RTX 4060 in a slim chassis may perform worse than the same GPU in a well-cooled build. Look for laptops with good thermal scores from reviews. Heavier chassis often mean better thermals. If you plan to render, animate, or run AI workflows for hours at a time, thermals matter significantly.",
  },
  {
    Icon: Wrench,
    id: "upgrade",
    title: "Upgradability",
    subtitle: "Extending Your Laptop's Life",
    iconClass: "text-orange-400",
    glowColor: "#fb923c",
    body: "A laptop with upgradeable RAM and a free M.2 slot gives you the ability to extend its useful life. Starting with 16GB RAM and upgrading to 32GB a year later is much cheaper than buying a new laptop. When comparing two otherwise similar laptops, the one with upgradeable RAM and expandable storage has meaningfully better four-year value.",
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
      <section id="explainer" className="px-4 py-20 max-w-7xl mx-auto w-full">
        <m.div
          className="mb-14 text-center"
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
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
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
      className="relative glass-card rounded-2xl border overflow-hidden flex flex-col gap-5 p-8 cursor-default"
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

      {/* Body */}
      <p className="relative z-10 text-sm text-muted-foreground leading-relaxed">
        {item.body}
      </p>
    </m.div>
  );
}
