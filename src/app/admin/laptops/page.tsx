import { createClient } from "@/lib/supabase/server";
import { Plus } from "lucide-react";
import { LaptopListWithPreview } from "@/components/admin/LaptopListWithPreview";
import type { AdminLaptop } from "@/components/admin/LaptopListWithPreview";
import { AdminGuideLink } from "@/components/admin/guide/AdminGuideLink";

export default async function AdminLaptopsPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("laptops")
    .select("*")
    .order("updated_at", { ascending: false });

  const laptops: AdminLaptop[] = (data ?? []).map((row) => ({
    id: row.id,
    slug: row.slug ?? "",
    domain: row.domain ?? "design",
    name: row.name,
    brand: row.brand,
    model: row.model,
    price_approx: row.price_approx,
    price_label: row.price_label,
    amazon_affiliate_url: row.amazon_affiliate_url ?? "",
    image_url: row.image_url,
    cpu: row.cpu,
    gpu: row.gpu,
    gpu_vram_gb: row.gpu_vram_gb,
    ram: row.ram,
    ram_gb: row.ram_gb,
    storage: row.storage,
    storage_gb: row.storage_gb,
    display: row.display,
    weight: row.weight,
    os: row.os,
    tier: row.tier,
    workload_tags: row.workload_tags ?? [],
    recommended_for_courses: row.recommended_for_courses ?? [],
    not_ideal_for: row.not_ideal_for ?? [],
    why_recommended: row.why_recommended,
    cautions: row.cautions,
    upgrade_notes: row.upgrade_notes,
    four_year_suitability: row.four_year_suitability,
    priority_score: row.priority_score ?? 50,
    availability: row.availability ?? null,
    last_checked: row.last_checked ?? null,
    is_published: row.is_published ?? false,
    feature_on_home: row.feature_on_home ?? false,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold text-foreground">Laptops</h1>
        <div className="flex flex-wrap items-center gap-2">
          <AdminGuideLink section="laptops" />
          <a
            href="/admin/laptops/new"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-[min(var(--radius-md),12px)] bg-primary px-3 text-[0.8rem] font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Plus className="w-4 h-4" />
            Add Laptop
          </a>
        </div>
      </div>

      <LaptopListWithPreview laptops={laptops} />
    </div>
  );
}
