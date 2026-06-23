// Central, config-in-code definition of the three audience domains the site
// serves. The DB only stores (a) the per-domain enable flags (settings table,
// see flags.ts) and (b) the admin-managed taxonomy (courses table, see
// taxonomy.ts). Everything *presentational* — labels, hero copy, SEO metadata,
// Chip's persona — lives here so it is versioned and reviewable.
//
// Per-domain colour theming is handled in globals.css via the
// `[data-domain="…"]` attribute set on the DomainLanding wrapper.

export type DomainId = "design" | "technology" | "management";

export type DomainFlagKey = "domain_tech_enabled" | "domain_mgmt_enabled";

/**
 * Lucide icon names usable in the "changing landscape" cards. AISection maps
 * each name to its imported icon component, so this stays a plain string union
 * (no lucide import needed in this config module).
 */
export type LandscapeIconName =
  | "Sparkles"
  | "Layers"
  | "Film"
  | "Gamepad2"
  | "Cpu"
  | "BrainCircuit"
  | "Code2"
  | "Database"
  | "Smartphone"
  | "ShieldCheck"
  | "Cloud"
  | "Briefcase"
  | "TrendingUp"
  | "BarChart3"
  | "Megaphone"
  | "Boxes"
  | "Package";

/** Compute-intensity label shown on each landscape card (drives its colour). */
export type LandscapeHorizon = "Moderate" | "Significant" | "Very High" | "Critical";

export interface LandscapeDiscipline {
  icon: LandscapeIconName;
  iconClass: string;
  /** The discipline / field / specialisation this card describes. */
  discipline: string;
  /** How its workflow is shifting and what that means for hardware. */
  shift: string;
  horizon: LandscapeHorizon;
}

export interface DomainConfig {
  id: DomainId;
  label: string;
  /** Public route. Design is the default homepage. */
  route: string;
  /** Tab display order, low to high. */
  order: number;
  /**
   * Settings flag gating this domain. `undefined` for Design, which is always
   * on (the site's original, untouched experience).
   */
  flagKey?: DomainFlagKey;
  hero: {
    badge: string;
    titleLead: string;
    titleAccent: string;
    subtitle: string;
  };
  finder: {
    /** Sub-line under the "Find your laptop" heading. */
    subtitle: string;
    /** Smaller reassurance note below the sub-line. */
    note: string;
  };
  metaTitle: string;
  metaDescription: string;
  chip: {
    /** One-line description of who Chip is for this domain. */
    persona: string;
    /** What we call the user's specialisation, e.g. "design discipline". */
    disciplineLabel: string;
    /** Comma-separated examples of disciplines for the chosen domain. */
    disciplineExamples: string;
    /** Multi-line discipline → likely software cheat-sheet for this domain. */
    cheatSheet: string;
    /** Chip's opening greeting in the widget. */
    greeting: string;
    /** Initial suggestion chips offered with the greeting. */
    roleSuggestions: string[];
  };
  /**
   * "The changing landscape" section — domain-specific discipline cards
   * explaining how each field's workflow is evolving and what that means for
   * laptop choice. Rendered by AISection.
   */
  landscape: {
    /** Small uppercase eyebrow above the heading. */
    eyebrow: string;
    heading: string;
    intro: string;
    disciplines: LandscapeDiscipline[];
    /** Body of the "A note on planning" callout (the label is fixed). */
    planningNote: string;
  };
}

export const DOMAINS: Record<DomainId, DomainConfig> = {
  design: {
    id: "design",
    label: "Design",
    route: "/",
    order: 1,
    hero: {
      badge: "Trusted by design students & professionals",
      titleLead: "Find the right laptop for",
      titleAccent: "your design journey",
      subtitle:
        "Whether you're heading into design school or deep into professional practice — answer a few quick questions and get matched to hardware built for the work you actually do.",
    },
    finder: {
      subtitle: "Filter by course, budget, and workload",
      note: "Every laptop listed here is hand-picked based on real course requirements and years of experience guiding design students.",
    },
    metaTitle: "Find My Laptop — Design Course Laptop Recommender",
    metaDescription:
      "Find the perfect laptop for your design course. Get personalised recommendations based on your discipline, budget, and creative workflow.",
    chip: {
      persona:
        "a sharp, empathetic laptop advisor and design mentor for designers in India",
      disciplineLabel: "design discipline",
      disciplineExamples:
        "graphic, UI/UX, product, fashion, motion/VFX, game/3D, architecture",
      cheatSheet: `- Graphic / visual design → Photoshop, Illustrator, InDesign, Figma
- UI/UX → Figma, Adobe XD
- Product / industrial design → Fusion 360, SolidWorks, Rhino, Blender, KeyShot
- Fashion design → CLO 3D, Browzwear, Illustrator
- Motion / VFX → After Effects, Premiere, Blender, Cinema 4D, DaVinci Resolve
- Game / 3D art → Blender, Maya, Unreal Engine, Unity, Substance Painter
- Architecture / interior → AutoCAD, SketchUp, Revit, 3ds Max, Lumion`,
      greeting:
        "Hi! I'm Chip 👋 I help designers find the right laptop — whether you're just starting out, in school, or working professionally.\n\nAre you a design aspirant, student, or working professional?",
      roleSuggestions: [
        "Design Aspirant / Fresher",
        "Design Student",
        "Working Design Professional",
        "Just Exploring",
      ],
    },
    landscape: {
      eyebrow: "The changing landscape",
      heading: "Design education is computationally evolving",
      intro:
        "Design students are no longer using laptops only for documentation, browsing, and basic layout work. Across disciplines, AI-assisted ideation, 3D visualisation, video workflows, simulation, and real-time rendering are becoming part of creative education. The right laptop should be chosen not only for the first semester, but for the full design-learning journey.",
      disciplines: [
        {
          icon: "Sparkles",
          iconClass: "text-amber-500 dark:text-amber-400",
          discipline: "Communication, Fashion, Brand",
          shift:
            "AI-assisted ideation, text-to-image generation, mockup creation, and brand toolkit automation are entering design workflows. 2D-heavy work remains manageable on mid-range hardware, but generative tools increasingly benefit from a capable GPU.",
          horizon: "Moderate",
        },
        {
          icon: "Layers",
          iconClass: "text-sky-500 dark:text-sky-400",
          discipline: "Product, Interaction, Interior",
          shift:
            "3D visualisation, parametric modelling, simulation tools, and real-time rendering previews are increasingly used across these disciplines. Expect Blender, Rhino, or SketchUp to be part of the toolkit within the first year.",
          horizon: "Significant",
        },
        {
          icon: "Film",
          iconClass: "text-violet-500 dark:text-violet-400",
          discipline: "Animation, Film, Motion",
          shift:
            "GPU rendering (Cycles, V-Ray, Arnold), AI-assisted in-betweening, motion capture processing, and video grading workflows demand heavy compute. 8GB+ VRAM and fast multi-core CPUs are not optional for sustained use.",
          horizon: "Very High",
        },
        {
          icon: "Gamepad2",
          iconClass: "text-emerald-500 dark:text-emerald-400",
          discipline: "Game Art, Game Design, Programming",
          shift:
            "Real-time rendering engines (Unreal 5, Unity), procedural asset creation, shader development, and live game testing are the core workflow. RTX 4060 is a practical minimum; 4070 is strongly preferred for Unreal 5 work.",
          horizon: "Very High",
        },
        {
          icon: "Cpu",
          iconClass: "text-rose-500 dark:text-rose-400",
          discipline: "Transportation & Mobility Design",
          shift:
            "Surfacing, photorealistic rendering, fluid simulation, and structural analysis tools are computationally intensive. These disciplines sit at the high end of hardware requirements — plan for the highest practical GPU tier in your budget.",
          horizon: "Very High",
        },
        {
          icon: "BrainCircuit",
          iconClass: "text-indigo-500 dark:text-indigo-400",
          discipline: "AI in Creative Practice",
          shift:
            "Running local diffusion models, fine-tuning workflows, generative design scripting, and GPU-accelerated inference require 8GB+ VRAM as a baseline. This discipline has the highest compute requirements of any design course.",
          horizon: "Critical",
        },
      ],
      planningNote:
        "Students do not always need the most expensive laptop. But they should buy with a 3–4 year academic journey in mind. A well-chosen ₹90,000 laptop with 16GB RAM, an RTX 4060, and an upgradeable slot will serve most students better than a ₹1,20,000 thin laptop with soldered 16GB RAM and an RTX 4050.",
    },
  },

  technology: {
    id: "technology",
    label: "Technology",
    route: "/technology",
    order: 2,
    flagKey: "domain_tech_enabled",
    hero: {
      badge: "Trusted by tech students & engineers",
      titleLead: "Find the right laptop for",
      titleAccent: "your tech career",
      subtitle:
        "From your first CS course to shipping production code — answer a few quick questions and get matched to a machine that handles your stack, your builds, and your future workload.",
    },
    finder: {
      subtitle: "Filter by field, budget, and workload",
      note: "Every laptop listed here is hand-picked for real engineering workloads — compiling, containers, data, and ML — not just spec-sheet numbers.",
    },
    metaTitle: "Find My Laptop — Best Laptops for Tech & Engineering Students",
    metaDescription:
      "Find the perfect laptop for software, data science, AI, cybersecurity, and engineering. Personalised picks by field, budget, and workload.",
    chip: {
      persona:
        "a sharp, empathetic laptop advisor and engineering mentor for tech students and developers in India",
      disciplineLabel: "tech field",
      disciplineExamples:
        "web/full-stack, data science, machine learning, mobile, cybersecurity, DevOps/cloud, game programming",
      cheatSheet: `- Web / full-stack → VS Code, Docker, Node, browsers + many tabs (RAM-hungry, GPU optional)
- Data science / analytics → Python, Jupyter, pandas, SQL (RAM + CPU matter most)
- Machine learning / AI → PyTorch, TensorFlow, CUDA (NVIDIA GPU + VRAM strongly preferred)
- Mobile app dev → Android Studio / Xcode emulators (lots of RAM; Apple Silicon great for iOS)
- Cybersecurity → Kali, VMs, multiple VMs at once (RAM + virtualization support)
- DevOps / cloud → Docker, Kubernetes, local clusters (RAM + multi-core CPU)
- Game programming → Unreal/Unity, C++ builds (strong GPU + CPU + VRAM)`,
      greeting:
        "Hi! I'm Chip 👋 I help tech students and developers find the right laptop — whether you're starting your first course, in college, or working in the field.\n\nAre you a student, self-learner, or working professional?",
      roleSuggestions: [
        "CS / Engineering Student",
        "Self-taught / Bootcamp",
        "Working Developer",
        "Just Exploring",
      ],
    },
    landscape: {
      eyebrow: "The changing landscape",
      heading: "Tech education is computationally evolving",
      intro:
        "Tech students quickly move beyond a single editor and a browser. Containers, large datasets, local model training, virtual machines, and game engines all become part of coursework — and each pushes a different part of the machine. The right laptop should carry you from your first course through internships and real production work.",
      disciplines: [
        {
          icon: "Code2",
          iconClass: "text-sky-500 dark:text-sky-400",
          discipline: "Web & Full-Stack Development",
          shift:
            "VS Code, Node, Docker, local databases, and a browser with dozens of tabs run side by side all day. This is RAM- and CPU-bound work; a dedicated GPU is rarely needed, but 16GB RAM and a fast SSD make a real difference.",
          horizon: "Moderate",
        },
        {
          icon: "Database",
          iconClass: "text-cyan-500 dark:text-cyan-400",
          discipline: "Data Science & Analytics",
          shift:
            "Python, Jupyter, pandas, and SQL over progressively larger datasets reward memory and multi-core CPUs. Most work is fine on a strong CPU; a GPU only starts to matter once you move into deep learning.",
          horizon: "Significant",
        },
        {
          icon: "BrainCircuit",
          iconClass: "text-indigo-500 dark:text-indigo-400",
          discipline: "Machine Learning & AI",
          shift:
            "Training and fine-tuning with PyTorch or TensorFlow, CUDA acceleration, and running models locally are the most demanding workloads here. An NVIDIA GPU with 8GB+ VRAM and 32GB RAM saves hours of waiting.",
          horizon: "Critical",
        },
        {
          icon: "Smartphone",
          iconClass: "text-emerald-500 dark:text-emerald-400",
          discipline: "Mobile App Development",
          shift:
            "Android Studio and iOS emulators are heavy on RAM and CPU, and emulator counts grow as projects do. Apple Silicon is excellent for iOS; for Android, prioritise 16GB+ RAM and a capable multi-core CPU.",
          horizon: "Significant",
        },
        {
          icon: "ShieldCheck",
          iconClass: "text-rose-500 dark:text-rose-400",
          discipline: "Cybersecurity, DevOps & Cloud",
          shift:
            "Running several VMs at once, local Kubernetes clusters, and security labs demands lots of RAM, virtualization support, and a strong multi-core CPU. 32GB RAM and a fast SSD are well worth it for sustained lab work.",
          horizon: "Very High",
        },
        {
          icon: "Gamepad2",
          iconClass: "text-amber-500 dark:text-amber-400",
          discipline: "Game Programming",
          shift:
            "Unreal Engine and Unity with frequent C++ or shader compilation lean on the GPU, CPU, and VRAM together. RTX-class graphics, a fast multi-core CPU, and 16GB+ RAM keep build and iteration times sane.",
          horizon: "Very High",
        },
      ],
      planningNote:
        "You don't always need the most expensive machine. Buy for a 3–4 year journey: 16GB RAM, a fast multi-core CPU, and a quick SSD matter more day-to-day than a top GPU. Step up to 32GB RAM if you'll run many containers or VMs, and add a strong NVIDIA GPU only if machine learning, CUDA, or game-engine work is on your path.",
    },
  },

  management: {
    id: "management",
    label: "Management",
    route: "/management",
    order: 3,
    flagKey: "domain_mgmt_enabled",
    hero: {
      badge: "Trusted by business & management students",
      titleLead: "Find the right laptop for",
      titleAccent: "your business school journey",
      subtitle:
        "From your MBA to the boardroom — answer a few quick questions and get matched to a laptop that's light to carry, lasts all day, and breezes through analytics and presentations.",
    },
    finder: {
      subtitle: "Filter by specialisation, budget, and workload",
      note: "Every laptop listed here is hand-picked for real business workloads — long battery, portability, and smooth analytics — not gaming-grade overkill.",
    },
    metaTitle: "Find My Laptop — Best Laptops for MBA & Management Students",
    metaDescription:
      "Find the perfect laptop for an MBA, finance, analytics, or marketing. Personalised picks by specialisation, budget, and workload.",
    chip: {
      persona:
        "a sharp, empathetic laptop advisor and mentor for business and management students and professionals in India",
      disciplineLabel: "area of management",
      disciplineExamples:
        "general MBA, finance, business analytics, marketing, operations, product management",
      cheatSheet: `- General MBA → Office, browser, video calls, light multitasking (portability + battery first)
- Finance / FinTech → Excel (heavy models), Power BI, occasional Python/R (RAM + fast CPU)
- Business analytics → Excel, Tableau/Power BI, SQL, some Python (RAM + decent CPU)
- Marketing / digital → Office, Canva, light photo/video edit, many tabs (balanced, good screen)
- Operations / supply chain → Excel, simulation/optimisation tools (CPU + RAM)
- Product management → Figma viewing, docs, analytics dashboards (balanced, portable)`,
      greeting:
        "Hi! I'm Chip 👋 I help business and management students find the right laptop — whether you're starting your degree, mid-MBA, or already working.\n\nAre you a student, MBA candidate, or working professional?",
      roleSuggestions: [
        "Management Student",
        "MBA Candidate",
        "Working Professional",
        "Just Exploring",
      ],
    },
    landscape: {
      eyebrow: "The changing landscape",
      heading: "Business education is going data-driven",
      intro:
        "Management work runs on spreadsheets, decks, and dashboards — but it is increasingly data-driven, with BI tools, large financial models, and even light scripting entering the classroom. The right laptop is one you can carry all day, that lasts through back-to-back sessions, and that never stutters during a presentation.",
      disciplines: [
        {
          icon: "Briefcase",
          iconClass: "text-sky-500 dark:text-sky-400",
          discipline: "General MBA & Strategy",
          shift:
            "Office apps, video calls, case readings, and a browser full of tabs are the everyday load. Raw power matters far less here than all-day battery, a light chassis, and a comfortable keyboard for long days.",
          horizon: "Moderate",
        },
        {
          icon: "TrendingUp",
          iconClass: "text-emerald-500 dark:text-emerald-400",
          discipline: "Finance & FinTech",
          shift:
            "Large, multi-tab Excel models, Power BI, and the occasional Python or R script reward memory and a fast CPU. 16GB RAM and a modern multi-core processor keep heavy workbooks responsive.",
          horizon: "Significant",
        },
        {
          icon: "BarChart3",
          iconClass: "text-cyan-500 dark:text-cyan-400",
          discipline: "Business Analytics",
          shift:
            "Tableau or Power BI, SQL, and some Python over real datasets are now standard. A strong CPU and 16GB+ RAM matter most; a dedicated GPU is rarely needed for typical coursework.",
          horizon: "Significant",
        },
        {
          icon: "Megaphone",
          iconClass: "text-violet-500 dark:text-violet-400",
          discipline: "Marketing & Digital",
          shift:
            "Office, Canva, light photo and video editing, and many open tabs call for balanced specs and a good screen. A bright, colour-accurate display helps more than extra raw horsepower.",
          horizon: "Moderate",
        },
        {
          icon: "Boxes",
          iconClass: "text-amber-500 dark:text-amber-400",
          discipline: "Operations & Supply Chain",
          shift:
            "Excel at scale plus simulation and optimisation tools lean on the CPU and memory. A capable multi-core processor and 16GB RAM keep models and solvers moving without long waits.",
          horizon: "Significant",
        },
        {
          icon: "Package",
          iconClass: "text-rose-500 dark:text-rose-400",
          discipline: "Product Management",
          shift:
            "Viewing Figma, writing docs, and reading analytics dashboards span a wide app mix. Prioritise a portable, balanced machine with a good screen and solid battery over peak performance.",
          horizon: "Moderate",
        },
      ],
      planningNote:
        "You rarely need a powerful laptop for management work. Prioritise a light chassis, all-day battery, a comfortable keyboard, and a sharp screen for long reading and presentations. 16GB RAM and a modern CPU handle Excel, BI tools, and dozens of tabs with ease — a gaming-grade GPU is seldom worth the added weight and shorter battery life.",
    },
  },
};

/** Domains in tab display order. */
export const DOMAIN_ORDER: DomainConfig[] = Object.values(DOMAINS).sort(
  (a, b) => a.order - b.order
);

export function isDomainId(value: string | undefined | null): value is DomainId {
  return value === "design" || value === "technology" || value === "management";
}

export function getDomainByRoute(route: string): DomainConfig | undefined {
  return DOMAIN_ORDER.find((d) => d.route === route);
}
