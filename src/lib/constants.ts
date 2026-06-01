export const COURSE_CATEGORIES = [
  "Fashion and Lifestyle",
  "Communication and Digital Media",
  "Industrial and Interaction Design",
  "Game, Animation, and Film",
  "Interior and Spatial Design",
  "AI and Emerging Creative Practice",
  "Foundation / Global Design",
] as const;

export const COURSES_BY_CATEGORY: Record<string, string[]> = {
  "Fashion and Lifestyle": [
    "Fashion Design & Technology",
    "Fashion Communication & Styling",
    "Luxury & Brand Management",
  ],
  "Communication and Digital Media": [
    "Communication Design",
    "Digital Design",
  ],
  "Industrial and Interaction Design": [
    "Product & Service Design",
    "Interaction Design",
    "Transportation & Mobility Design",
  ],
  "Game, Animation, and Film": [
    "Game Art",
    "Game Design / Programming",
    "Animation & Film Making",
  ],
  "Interior and Spatial Design": [
    "Interior Architecture & Design",
  ],
  "AI and Emerging Creative Practice": [
    "AI in Creative Practice",
  ],
  "Foundation / Global Design": [
    "Global Design Programme",
  ],
};

export const WORKLOAD_DESCRIPTIONS = {
  light: "Mostly 2D, communication, writing, and presentation work",
  balanced: "Mix of 2D and some 3D, rendering, and design software",
  heavy: "Intensive 3D, animation, game development, AI workflows, or video production",
} as const;

export const BUDGET_RANGES = [
  { label: "Under ₹50,000", value: 50000 },
  { label: "Under ₹70,000", value: 70000 },
  { label: "Under ₹90,000", value: 90000 },
  { label: "Under ₹1,10,000", value: 110000 },
  { label: "Under ₹1,30,000", value: 130000 },
  { label: "Under ₹1,60,000", value: 160000 },
  { label: "Under ₹2,00,000", value: 200000 },
  { label: "₹2,00,000+", value: 999999 },
] as const;

export const TIER_LABELS: Record<string, string> = {
  budget: "Budget",
  value: "Value",
  balanced: "Balanced",
  advanced: "Advanced",
  premium: "Premium",
};

export const FOUR_YEAR_LABELS: Record<string, string> = {
  basic: "Basic",
  good: "Good",
  strong: "Strong",
  excellent: "Excellent",
};

export const WORKLOAD_TAGS = [
  { value: "2d", label: "2D Design" },
  { value: "uiux", label: "UI/UX" },
  { value: "video", label: "Video Editing" },
  { value: "fashion", label: "Fashion" },
  { value: "interior", label: "Interior Design" },
  { value: "product", label: "Product Design" },
  { value: "animation", label: "Animation" },
  { value: "game", label: "Game Dev" },
  { value: "3d", label: "3D Modeling" },
  { value: "ai", label: "AI Workflows" },
  { value: "coding", label: "Coding" },
  { value: "rendering", label: "Rendering" },
] as const;

export const GPU_STRENGTH_ORDER: Record<string, number> = {
  "rtx 4090": 100,
  "rtx 4080": 90,
  "rtx 4070": 80,
  "rtx 4060": 70,
  "rtx 4050": 60,
  "rtx 3080": 75,
  "rtx 3070": 65,
  "rtx 3060": 55,
  "rtx 3050": 45,
  "rtx 2060": 40,
  "gtx 1650": 25,
  "iris xe": 10,
  "integrated": 5,
};

export function getGpuStrengthScore(gpu: string | null | undefined): number {
  if (!gpu) return 0;
  const lower = gpu.toLowerCase();
  for (const [key, score] of Object.entries(GPU_STRENGTH_ORDER)) {
    if (lower.includes(key)) return score;
  }
  return 30;
}

export const SORT_OPTIONS = [
  { value: "recommended", label: "Best Match" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "gpu-strength", label: "GPU Strength" },
  { value: "four-year", label: "4-Year Suitability" },
] as const;

export const PREFERENCE_OPTIONS = [
  { value: "performance", label: "Maximum Performance", description: "Best GPU and CPU for demanding work" },
  { value: "portability", label: "Portability First", description: "Lighter and thinner, carry it easily" },
  { value: "budget", label: "Best Budget Pick", description: "Maximum value for money" },
  { value: "future-proof", label: "Future-Ready", description: "Built to last 4+ years of design education" },
  { value: "balanced", label: "Balanced All-Rounder", description: "Good across performance, portability, and price" },
] as const;

export const WHATSAPP_FALLBACK = "https://chat.whatsapp.com/REPLACE_WITH_GROUP_LINK";
