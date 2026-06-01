import { Cpu, Zap, MemoryStick, HardDrive, Monitor, Thermometer, Wrench } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const EXPLAINERS = [
  {
    icon: <Cpu className="w-4 h-4 text-primary" />,
    id: "cpu",
    title: "CPU — The Brain",
    body: "The CPU handles all computation — running your software, processing files, and managing multitasking. For design students, a modern Intel Core i7/i9 H-series or AMD Ryzen 7/9 HS/HX gives you smooth Photoshop, Illustrator, and Figma performance. A stronger CPU also speeds up 3D rendering bakes, video exports, and simulation calculations. Look for H-class (not U-class) CPUs for real sustained performance under load.",
  },
  {
    icon: <Zap className="w-4 h-4 text-amber-400" />,
    id: "gpu",
    title: "GPU — The Visual Engine",
    body: "The GPU powers 3D rendering, video processing, AI image generation, real-time previews in tools like Blender and Unreal Engine, and simulations. For most design courses, an NVIDIA RTX 4050 (6GB VRAM) is a practical minimum. RTX 4060 (8GB) is strongly preferred for 3D-heavy, game, animation, or AI workflows. VRAM (GPU memory) is the most critical figure — 6–8GB is the practical minimum for modern creative workflows. More VRAM = larger scenes, faster rendering, and better AI model performance.",
  },
  {
    icon: <MemoryStick className="w-4 h-4 text-sky-400" />,
    id: "ram",
    title: "RAM — Your Working Table",
    body: "RAM is the workspace where your laptop holds active tasks. 16GB is the minimum for design work. 24–32GB is strongly preferred for students working with 3D, multiple large files, rendering, and AI tools simultaneously. Upgradeable RAM is a significant advantage — it extends the usable life of your laptop. Soldered RAM (non-upgradeable) means your laptop is capped at the RAM it ships with.",
  },
  {
    icon: <HardDrive className="w-4 h-4 text-violet-400" />,
    id: "ssd",
    title: "SSD — Speed and Space",
    body: "The SSD is your storage. A fast NVMe SSD means faster boot times, quicker file saves, and smoother 3D asset loading. 512GB is a bare minimum — assets, textures, renders, and video footage fill up space fast. 1TB is the recommended starting point. An M.2 expansion slot is a practical advantage as it lets you add storage later without replacing the drive.",
  },
  {
    icon: <Monitor className="w-4 h-4 text-emerald-400" />,
    id: "display",
    title: "Display — Colour and Clarity",
    body: "For design work, colour accuracy matters. Look for displays with 100% sRGB coverage or higher. DCI-P3 coverage is a bonus for video and photography disciplines. A 15–16 inch display is generally more comfortable for creative work. Higher refresh rates (144Hz+) are useful for game design and animation students but less critical for 2D and communication design courses.",
  },
  {
    icon: <Thermometer className="w-4 h-4 text-rose-400" />,
    id: "thermals",
    title: "Thermals — Performance Under Load",
    body: "Thin laptops with powerful GPUs often throttle (slow down) under sustained load to prevent overheating. This means the RTX 4060 in a slim gaming laptop may perform worse than the same GPU in a well-cooled chassis. Look for laptops with good thermal scores from reviews. Heavier chassis often mean better thermals. If you plan to render, animate, or run AI workflows for hours at a time, thermals matter significantly.",
  },
  {
    icon: <Wrench className="w-4 h-4 text-orange-400" />,
    id: "upgrade",
    title: "Upgradeability — Extending Your Laptop's Life",
    body: "A laptop with upgradeable RAM and a free M.2 slot gives you the ability to extend its useful life. Starting with 16GB RAM and upgrading to 32GB a year later is much cheaper than buying a new laptop. When comparing two otherwise similar laptops, the one with upgradeable RAM and expandable storage has meaningfully better four-year value.",
  },
];

export function HardwareExplainer() {
  return (
    <section id="explainer" className="px-4 py-14 max-w-3xl mx-auto w-full">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-bold text-foreground mb-2">
          Understanding laptop specs
        </h2>
        <p className="text-muted-foreground text-sm max-w-xl mx-auto">
          Not sure what CPU, VRAM, or thermals mean? Here's everything you need
          to know — in plain language.
        </p>
      </div>

      <Accordion className="space-y-2">
        {EXPLAINERS.map((item) => (
          <AccordionItem
            key={item.id}
            className="glass-card rounded-xl border px-4"
          >
            <AccordionTrigger className="hover:no-underline py-4">
              <div className="flex items-center gap-3 text-left">
                {item.icon}
                <span className="font-medium text-sm text-foreground">{item.title}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <p className="text-sm text-muted-foreground leading-relaxed pb-2">
                {item.body}
              </p>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
