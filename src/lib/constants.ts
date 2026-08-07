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

// Workload tags are now defined per-domain in domains.ts (DomainConfig.workloadTags)
// and aggregated as ALL_WORKLOAD_TAGS.

// Rough 0–100 standing of a *laptop* GPU, used to rank capability.
//
// Key order is load-bearing: getGpuStrengthScore returns the first substring
// match, so every "Ti" variant must sit immediately before its base model
// ("rtx 5070 ti" before "rtx 5070") and specific names before generic ones.
export const GPU_STRENGTH_ORDER: Record<string, number> = {
  "rtx 5090": 100,
  "rtx 5080": 95,
  "rtx 4090": 94,
  "rtx 5070 ti": 88,
  "rtx 4080": 87,
  "rtx 5070": 82,
  "rtx 4070 ti": 80,
  "rtx 4070": 78,
  "rtx 3080 ti": 77,
  "rtx 3080": 75,
  "rtx 5060": 72,
  "rtx 4060": 70,
  "rtx 3070 ti": 67,
  "rtx 3070": 65,
  "rtx 5050": 62,
  "rtx 4050": 60,
  "rtx 3060": 55,
  "rtx 3050 ti": 48,
  "rtx 3050": 45,
  "rtx 2060": 40,
  "rtx 2050": 35,
  "gtx 1660": 28,
  "gtx 1650": 25,
  "intel arc": 14,
  "radeon graphics": 12,
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

export const BRANDS = [
  "Apple",
  "ASUS",
  "Lenovo",
  "HP",
  "Dell",
  "Acer",
  "MSI",
  "Samsung",
  "LG",
  "Razer",
] as const;

export const PROCESSOR_TYPES = [
  { value: "intel", label: "Intel Core" },
  { value: "amd", label: "AMD Ryzen" },
  { value: "apple", label: "Apple Silicon" },
] as const;

export const SORT_OPTIONS = [
  { value: "recommended", label: "Best Match" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
] as const;

export const PREFERENCE_OPTIONS = [
  { value: "performance", label: "Maximum Performance", description: "Best GPU and CPU for demanding work" },
  { value: "portability", label: "Portability First", description: "Lighter and thinner, carry it easily" },
  { value: "budget", label: "Best Budget Pick", description: "Maximum value for money" },
  { value: "future-proof", label: "Future-Ready", description: "Built to last 4+ years of design education" },
  { value: "balanced", label: "Balanced All-Rounder", description: "Good across performance, portability, and price" },
] as const;

export const WHATSAPP_FALLBACK = "https://chat.whatsapp.com/REPLACE_WITH_GROUP_LINK";
