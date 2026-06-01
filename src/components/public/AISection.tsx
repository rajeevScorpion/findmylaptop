import { Sparkles, Layers, Film, Cpu, Gamepad2, BrainCircuit } from "lucide-react";

const DISCIPLINES = [
  {
    icon: <Sparkles className="w-4 h-4 text-amber-400" />,
    discipline: "Communication, Fashion, Brand",
    shift: "AI-assisted ideation, text-to-image generation, mockup creation, and brand toolkit automation are entering design workflows. 2D-heavy work remains manageable on mid-range hardware, but generative tools increasingly benefit from a capable GPU.",
    horizon: "Moderate",
    color: "amber",
  },
  {
    icon: <Layers className="w-4 h-4 text-sky-400" />,
    discipline: "Product, Interaction, Interior",
    shift: "3D visualisation, parametric modelling, simulation tools, and real-time rendering previews are increasingly used across these disciplines. Expect Blender, Rhino, or SketchUp to be part of the toolkit within the first year.",
    horizon: "Significant",
    color: "sky",
  },
  {
    icon: <Film className="w-4 h-4 text-violet-400" />,
    discipline: "Animation, Film, Motion",
    shift: "GPU rendering (Cycles, V-Ray, Arnold), AI-assisted in-betweening, motion capture processing, and video grading workflows demand heavy compute. 8GB+ VRAM and fast multi-core CPUs are not optional for sustained use.",
    horizon: "Very High",
    color: "violet",
  },
  {
    icon: <Gamepad2 className="w-4 h-4 text-emerald-400" />,
    discipline: "Game Art, Game Design, Programming",
    shift: "Real-time rendering engines (Unreal 5, Unity), procedural asset creation, shader development, and live game testing are the core workflow. RTX 4060 is a practical minimum; 4070 is strongly preferred for Unreal 5 work.",
    horizon: "Very High",
    color: "emerald",
  },
  {
    icon: <Cpu className="w-4 h-4 text-rose-400" />,
    discipline: "Transportation & Mobility Design",
    shift: "Surfacing, photorealistic rendering, fluid simulation, and structural analysis tools are computationally intensive. These disciplines sit at the high end of hardware requirements — plan for the highest practical GPU tier in your budget.",
    horizon: "Very High",
    color: "rose",
  },
  {
    icon: <BrainCircuit className="w-4 h-4 text-indigo-400" />,
    discipline: "AI in Creative Practice",
    shift: "Running local diffusion models, fine-tuning workflows, generative design scripting, and GPU-accelerated inference require 8GB+ VRAM as a baseline. This discipline has the highest compute requirements of any design course.",
    horizon: "Critical",
    color: "indigo",
  },
];

const HORIZON_STYLES: Record<string, string> = {
  "Moderate": "text-muted-foreground",
  "Significant": "text-sky-400",
  "Very High": "text-amber-400",
  "Critical": "text-rose-400",
};

export function AISection() {
  return (
    <section className="px-4 py-14 max-w-4xl mx-auto w-full">
      <div className="mb-8 max-w-2xl">
        <p className="text-xs font-medium text-primary mb-2 uppercase tracking-wider">
          The changing landscape
        </p>
        <h2 className="text-2xl font-bold text-foreground mb-3">
          Design education is computationally evolving
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Design students are no longer using laptops only for documentation, browsing, and basic
          layout work. Across disciplines, AI-assisted ideation, 3D visualisation, video
          workflows, simulation, and real-time rendering are becoming part of creative education.
          The right laptop should be chosen not only for the first semester, but for the full
          design-learning journey.
        </p>
      </div>

      <div className="space-y-3">
        {DISCIPLINES.map((item) => (
          <div key={item.discipline} className="glass-card rounded-xl border p-4 flex gap-4">
            <div className="shrink-0 mt-0.5">{item.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <h3 className="text-sm font-medium text-foreground">{item.discipline}</h3>
                <span className={`text-xs font-medium shrink-0 ${HORIZON_STYLES[item.horizon] ?? ""}`}>
                  {item.horizon}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.shift}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 rounded-xl border border-primary/20 bg-primary/5">
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="font-medium text-foreground">A note on planning: </span>
          Students do not always need the most expensive laptop. But they should buy with a
          3–4 year academic journey in mind. A well-chosen ₹90,000 laptop with 16GB RAM,
          an RTX 4060, and an upgradeable slot will serve most students better than a
          ₹1,20,000 thin laptop with soldered 16GB RAM and an RTX 4050.
        </p>
      </div>
    </section>
  );
}
