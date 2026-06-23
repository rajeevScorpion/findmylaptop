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

/**
 * Lucide icon names usable in the per-domain advisory section. AdvisorySection
 * maps each name to its imported icon component, keeping this config module free
 * of component imports.
 */
export type AdvisoryIconName =
  | "Apple"
  | "Monitor"
  | "Cpu"
  | "Terminal"
  | "MemoryStick"
  | "Tablet"
  | "TriangleAlert"
  | "Cloud"
  | "Laptop";

export interface AdvisoryCard {
  icon: AdvisoryIconName;
  iconClass: string;
  title: string;
  /** One or more paragraphs of body copy for the card. */
  paragraphs: string[];
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
  /**
   * Domain-specific advisory section (rendered by AdvisorySection) — practical
   * "what about the machine you might already have / the common shortcut?"
   * guidance, tailored per domain.
   */
  advisory: {
    heading: string;
    subheading: string;
    cards: AdvisoryCard[];
    /** Body of the "Practical advice" footer callout (the label is fixed). */
    footer: string;
  };
  /**
   * Per-domain steering for the admin AI spec-extraction prompt ("Add Laptop").
   * The objective spec fields and output format are shared across domains; these
   * strings tailor the *reasoning* fields (why/cautions/4-year/priority) so a
   * laptop is judged by what actually matters to this audience.
   */
  extraction: {
    /** Who the laptop is judged for, e.g. "design students". */
    audience: string;
    /** What why_recommended should emphasise. */
    whyFocus: string;
    /** What cautions should call out (and what NOT to over-penalise). */
    cautionsFocus: string;
    /** Basis for the four_year_suitability rating. */
    suitabilityBasis: string;
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
    advisory: {
      heading: "Already have a MacBook or iPad?",
      subheading: "Here's how to think about it for design education.",
      cards: [
        {
          icon: "Apple",
          iconClass: "text-foreground/60",
          title: "MacBook Air / Pro (M-series)",
          paragraphs: [
            "MacBooks are excellent for writing, note-taking, web browsing, Figma, Sketch, light Adobe work, photography, and video editing in Final Cut. They run cool and quiet, and battery life is outstanding. If you already own one, it will serve you well for communication design, UI/UX, fashion communication, and brand management courses.",
            "However, for 3D modelling (Blender, Rhino, 3ds Max), game development (Unreal Engine), rendering with CUDA/NVIDIA acceleration, AI workflows with NVIDIA GPUs, and most simulation tools used in animation, game, product, interior, and transportation design — a Windows laptop with an NVIDIA RTX GPU is generally the safer, more capable choice. The design industry largely runs these tools on Windows with NVIDIA hardware.",
          ],
        },
        {
          icon: "Cpu",
          iconClass: "text-violet-500 dark:text-violet-400",
          title: "Windows + NVIDIA RTX — native AI advantage",
          paragraphs: [
            "NVIDIA's CUDA platform is the backbone of nearly every serious AI and creative computing tool — Stable Diffusion, ComfyUI, Blender Cycles, DaVinci Resolve, Topaz, and most local LLM runners (Ollama, llama.cpp) all run significantly faster, or exclusively, on CUDA. Apple Silicon has its own ML acceleration, but CUDA compatibility remains the industry standard and the gap widens as models grow larger.",
            "Regardless of your design discipline — even if you are studying communication or fashion — if you want to run local AI models, explore generative image workflows, automate tasks with AI scripts, or experiment with creative coding and diffusion tools, an NVIDIA RTX GPU gives you direct access to the full ecosystem without workarounds. This is increasingly relevant across every design field, not just the compute-heavy ones.",
          ],
        },
        {
          icon: "Monitor",
          iconClass: "text-foreground/60",
          title: "iPad",
          paragraphs: [
            "An iPad with Apple Pencil is a valuable companion for sketching, note-taking, ideation, and mood boarding. It is not a replacement for a laptop for design coursework. Use it alongside your main laptop, not instead of one.",
          ],
        },
      ],
      footer:
        "Students who already own a MacBook or iPad may use them initially and decide after understanding their specific course workload. Heavy 3D, animation, game, AI, and computational design workflows will benefit from a Windows machine with an NVIDIA RTX GPU sooner — but even lighter disciplines benefit the moment you want to run AI tools natively.",
    },
    extraction: {
      audience: "design students",
      whyFocus:
        "Focus on GPU and VRAM, RAM, and a colour-accurate display, plus practical creative-workflow benefits (3D, rendering, video, generative AI tools).",
      cautionsFocus:
        "Mention a weak GPU if VRAM < 6GB, soldered/non-upgradeable RAM, thermal throttling in thin laptops with powerful GPUs, heavy weight, an older CPU, or poor display colour accuracy.",
      suitabilityBasis:
        "based on sustained GPU/3D/rendering headroom for 4 years of design education",
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
    advisory: {
      heading: "Mac, Windows, or Linux for coding?",
      subheading: "Here's how to think about your operating system and specs.",
      cards: [
        {
          icon: "Terminal",
          iconClass: "text-emerald-500 dark:text-emerald-400",
          title: "macOS / Linux — a Unix shell by default",
          paragraphs: [
            "A Unix-based shell is the comfortable default for web, backend, DevOps, and cloud work — the terminal, package managers, Docker, and most tutorials assume it. A MacBook (M-series) is an excellent, quiet, long-battery choice here, and Linux runs beautifully on the right hardware.",
            "If your path is web development, backend and APIs, data work, or cloud, a Mac or Linux machine is friction-free. Apple Silicon is also outstanding for iOS and mobile development.",
          ],
        },
        {
          icon: "Cpu",
          iconClass: "text-blue-500 dark:text-blue-400",
          title: "Windows + WSL2 — and where NVIDIA pulls ahead",
          paragraphs: [
            "Windows has closed most of the gap thanks to WSL2, which runs a real Linux environment alongside Windows — perfectly fine for the vast majority of coursework, and often the most flexible single machine.",
            "The one place Windows with an NVIDIA GPU clearly pulls ahead is machine learning and game-engine development: CUDA acceleration is effectively required for serious local model training, and Unreal or Unity build best on a strong GPU. If ML/AI or game dev is on your path, lean Windows + NVIDIA.",
          ],
        },
        {
          icon: "MemoryStick",
          iconClass: "text-foreground/60",
          title: "What actually matters: RAM, CPU, SSD — GPU only sometimes",
          paragraphs: [
            "For most developers, RAM matters more than anything else — VMs, containers, multiple IDEs, and a browser full of tabs all live in memory. Aim for 16GB minimum, 32GB if you'll run many containers or VMs, paired with a fast multi-core CPU and a quick SSD.",
            "A dedicated GPU is optional unless you're doing ML/CUDA or game development — don't pay for one you won't use. The money is better spent on RAM and a better screen.",
          ],
        },
      ],
      footer:
        "Cloud and remote development — GitHub Codespaces, dev containers, and remote SSH — let a lighter, cheaper laptop punch well above its weight by offloading heavy compute. Buy for a 3–4 year journey: prioritise RAM, CPU, and SSD now, and add a strong NVIDIA GPU only when your field genuinely calls for it.",
    },
    extraction: {
      audience: "tech students and developers",
      whyFocus:
        "Focus on RAM, CPU cores, and SSD speed first, plus OS/Unix-shell fit. Mention a discrete NVIDIA GPU only when it helps ML/CUDA or game-engine work — a strong GPU is not required for web, backend, data, or mobile development.",
      cautionsFocus:
        "Mention only-8GB RAM (too little for containers, VMs, and IDEs), a slow or small SSD, soldered/non-upgradeable RAM, or a weak CPU. Flag a missing NVIDIA GPU only for ML or game-engine paths — do NOT penalise a missing discrete GPU for general development.",
      suitabilityBasis:
        "based on RAM, CPU, and SSD headroom for 4 years of engineering/CS work (GPU only if ML or game-dev is the path)",
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
    advisory: {
      heading: "Already have a MacBook or iPad?",
      subheading: "Here's how to think about it for business school.",
      cards: [
        {
          icon: "Apple",
          iconClass: "text-foreground/60",
          title: "MacBook / iPad for most MBA work",
          paragraphs: [
            "For the everyday business workload — Office, email, browser, presentations, video calls, and light analytics — a MacBook (M-series) is more than enough, and its portability and all-day battery are genuine assets for a mobile, presentation-heavy programme.",
            "If you already own one, it will carry you through most of an MBA comfortably. General management, strategy, marketing, and product specialisations rarely need anything Mac can't do.",
          ],
        },
        {
          icon: "TriangleAlert",
          iconClass: "text-amber-500 dark:text-amber-400",
          title: "The Windows-only software trap",
          paragraphs: [
            "There's one catch worth knowing before you commit to Mac-only: some business tools run on Windows only. Power BI Desktop is the most common — it has no native macOS version. Certain Excel add-ins (heavy Power Pivot / Solver setups, @RISK, Crystal Ball), SPSS, and some ERP / SAP lab tools also assume Windows.",
            "This mostly bites Finance and Business Analytics specialisations. If that's your direction, plan for a Windows machine, a virtual machine (Parallels), or your school's lab and cloud computers to cover those tools.",
          ],
        },
        {
          icon: "Tablet",
          iconClass: "text-foreground/60",
          title: "iPad — great companion, not a primary machine",
          paragraphs: [
            "An iPad with a keyboard is excellent for reading cases, taking notes, and light review on the move. But it isn't a substitute for a laptop when it comes to serious spreadsheet modelling, BI dashboards, or analytics coursework. Use it alongside your main machine, not instead of one.",
          ],
        },
      ],
      footer:
        "Prioritise weight, battery life, and a good screen over raw power — you'll carry this everywhere and present from it constantly. 16GB RAM and a modern CPU handle Excel, BI tools, and dozens of tabs with ease. Reach for Windows (or a cloud/VM workaround) the moment your electives lean into Windows-only analytics or finance tools.",
    },
    extraction: {
      audience: "business and management (MBA) students",
      whyFocus:
        "Focus on portability (light weight), all-day battery, a comfortable keyboard, and a sharp screen, plus enough RAM and CPU for large Excel models and BI tools. A discrete GPU is rarely needed.",
      cautionsFocus:
        "Mention heavy weight, poor battery life, only-8GB RAM for heavy Excel/BI work, a dim or low-resolution screen, or — for macOS machines — that some business tools (Power BI Desktop, certain Excel add-ins, SPSS) are Windows-only. Do NOT over-value a gaming GPU.",
      suitabilityBasis:
        "based on portability, battery, and smooth Excel/BI performance for a 2-year MBA (raw GPU power rarely matters)",
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
