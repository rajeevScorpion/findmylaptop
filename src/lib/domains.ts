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
