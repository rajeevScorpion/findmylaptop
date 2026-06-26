"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ProcessWithAI } from "./ProcessWithAI";
import { createClient } from "@/lib/supabase/client";
import { laptopFormSchema } from "@/lib/schemas";
import { generateSlug } from "@/lib/recommendationEngine";
import { TIER_LABELS } from "@/lib/constants";
import { DOMAINS, type DomainId } from "@/lib/domains";
import type { DomainTaxonomy } from "@/lib/taxonomy";
import type { Laptop, ProcessedLaptopInput } from "@/lib/types";

// Use input type so zodResolver's inferred type matches (arrays with .default([]) can be undefined on input)
type FormData = {
  name: string;
  domain: DomainId;
  amazon_affiliate_url: string;
  asin?: string;
  brand?: string;
  model?: string;
  price_approx?: number | "";
  price_label?: string;
  image_url?: string;
  cpu?: string;
  gpu?: string;
  gpu_vram_gb?: number | string | "";
  ram?: string;
  ram_gb?: number | "";
  storage?: string;
  storage_gb?: number | "";
  display?: string;
  weight?: string;
  os?: string;
  tier?: "budget" | "value" | "balanced" | "advanced" | "premium";
  workload_tags: string[];
  recommended_for_courses: string[];
  not_ideal_for: string[];
  why_recommended?: string;
  cautions?: string;
  upgrade_notes?: string;
  four_year_suitability?: "basic" | "good" | "strong" | "excellent";
  priority_score: number;
  is_published: boolean;
  raw_input?: string;
};

interface LaptopFormProps {
  laptop?: Laptop;
  /** DB-backed taxonomy per domain, used to tag recommended courses. */
  taxonomies: Record<DomainId, DomainTaxonomy>;
  /** Preview a suggested duplicate by id in the surrounding workspace, instead
   *  of navigating to its edit page. Provided on the "add" screen only. */
  onPreviewDuplicate?: (id: string) => void;
}

export function LaptopForm({ laptop, taxonomies, onPreviewDuplicate }: LaptopFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<FormData>({
    resolver: zodResolver(laptopFormSchema) as any,
    defaultValues: laptop
      ? {
          name: laptop.name,
          domain: (laptop.domain ?? "design") as DomainId,
          brand: laptop.brand ?? "",
          model: laptop.model ?? "",
          price_approx: laptop.price_approx ?? undefined,
          price_label: laptop.price_label ?? "",
          amazon_affiliate_url: laptop.amazon_affiliate_url,
          asin: laptop.asin ?? "",
          image_url: laptop.image_url ?? "",
          cpu: laptop.cpu ?? "",
          gpu: laptop.gpu ?? "",
          gpu_vram_gb: laptop.gpu_vram_gb ?? undefined,
          ram: laptop.ram ?? "",
          ram_gb: laptop.ram_gb ?? undefined,
          storage: laptop.storage ?? "",
          storage_gb: laptop.storage_gb ?? undefined,
          display: laptop.display ?? "",
          weight: laptop.weight ?? "",
          os: laptop.os ?? "",
          tier: laptop.tier ?? undefined,
          workload_tags: laptop.workload_tags ?? [],
          recommended_for_courses: laptop.recommended_for_courses ?? [],
          not_ideal_for: laptop.not_ideal_for ?? [],
          why_recommended: laptop.why_recommended ?? "",
          cautions: laptop.cautions ?? "",
          upgrade_notes: laptop.upgrade_notes ?? "",
          four_year_suitability: laptop.four_year_suitability ?? undefined,
          priority_score: laptop.priority_score ?? 50,
          is_published: laptop.is_published ?? false,
          raw_input: laptop.raw_input ?? "",
        }
      : {
          domain: "design",
          workload_tags: [],
          recommended_for_courses: [],
          not_ideal_for: [],
          priority_score: 50,
          is_published: false,
        },
  });

  const watchedTags = watch("workload_tags") ?? [];
  const watchedCourses = watch("recommended_for_courses") ?? [];
  const watchedPublished = watch("is_published");
  const watchedDomain = (watch("domain") ?? "design") as DomainId;
  const domainCourses = taxonomies[watchedDomain]?.coursesByCategory ?? {};
  const domainWorkloadTags = DOMAINS[watchedDomain].workloadTags;

  const handleAIProcessed = (data: ProcessedLaptopInput) => {
    if (data.name) setValue("name", data.name);
    if (data.brand) setValue("brand", data.brand);
    if (data.model) setValue("model", data.model);
    if (data.price_approx) setValue("price_approx", data.price_approx);
    if (data.price_label) setValue("price_label", data.price_label);
    if (data.image_url) setValue("image_url", data.image_url);
    if (data.amazon_affiliate_url) setValue("amazon_affiliate_url", data.amazon_affiliate_url);
    if (data.asin) setValue("asin", data.asin);
    if (data.cpu) setValue("cpu", data.cpu);
    if (data.gpu) setValue("gpu", data.gpu);
    if (data.gpu_vram_gb) setValue("gpu_vram_gb", data.gpu_vram_gb);
    if (data.ram) setValue("ram", data.ram);
    if (data.ram_gb) setValue("ram_gb", data.ram_gb);
    if (data.storage) setValue("storage", data.storage);
    if (data.storage_gb) setValue("storage_gb", data.storage_gb);
    if (data.display) setValue("display", data.display);
    if (data.weight) setValue("weight", data.weight);
    if (data.os) setValue("os", data.os);
    if (data.tier) setValue("tier", data.tier);
    if (data.workload_tags?.length) setValue("workload_tags", data.workload_tags);
    if (data.recommended_for_courses?.length) setValue("recommended_for_courses", data.recommended_for_courses);
    if (data.not_ideal_for?.length) setValue("not_ideal_for", data.not_ideal_for);
    if (data.why_recommended) setValue("why_recommended", data.why_recommended);
    if (data.cautions) setValue("cautions", data.cautions);
    if (data.upgrade_notes) setValue("upgrade_notes", data.upgrade_notes);
    if (data.four_year_suitability) setValue("four_year_suitability", data.four_year_suitability);
    if (data.priority_score) setValue("priority_score", data.priority_score);
  };

  const onSubmit = async (data: FormData) => {
    setSaving(true);
    setSaveError(null);

    const supabase = createClient();
    // For new laptops: generate a UUID now and bake it into the slug to guarantee uniqueness
    const newId = laptop ? undefined : crypto.randomUUID();
    const slug = laptop?.slug ?? generateSlug(data.name, newId);

    const payload = {
      ...(newId ? { id: newId } : {}),
      slug,
      name: data.name,
      domain: data.domain,
      brand: data.brand || null,
      model: data.model || null,
      price_approx: data.price_approx ? Number(data.price_approx) : null,
      price_label: data.price_label || null,
      amazon_affiliate_url: data.amazon_affiliate_url,
      asin: data.asin || null,
      image_url: data.image_url || null,
      cpu: data.cpu || null,
      gpu: data.gpu || null,
      gpu_vram_gb: data.gpu_vram_gb !== "" && data.gpu_vram_gb != null
        ? (isNaN(Number(data.gpu_vram_gb)) ? null : Number(data.gpu_vram_gb))
        : null,
      ram: data.ram || null,
      ram_gb: data.ram_gb ? Number(data.ram_gb) : null,
      storage: data.storage || null,
      storage_gb: data.storage_gb ? Number(data.storage_gb) : null,
      display: data.display || null,
      weight: data.weight || null,
      os: data.os || null,
      tier: data.tier || null,
      workload_tags: data.workload_tags,
      recommended_for_courses: data.recommended_for_courses,
      not_ideal_for: data.not_ideal_for,
      why_recommended: data.why_recommended || null,
      cautions: data.cautions || null,
      upgrade_notes: data.upgrade_notes || null,
      four_year_suitability: data.four_year_suitability || null,
      priority_score: data.priority_score,
      is_published: data.is_published,
      raw_input: data.raw_input || null,
    };

    let error;
    if (laptop) {
      ({ error } = await supabase.from("laptops").update(payload).eq("id", laptop.id));
    } else {
      ({ error } = await supabase.from("laptops").insert(payload));
    }

    if (error) {
      setSaveError(error.message);
      setSaving(false);
      return;
    }

    fetch("/api/admin/revalidate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tag: "laptops" }),
    });
    router.push("/admin/laptops");
    router.refresh();
  };

  const toggleTag = (tag: string) => {
    const current = watchedTags;
    setValue(
      "workload_tags",
      current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag]
    );
  };

  const toggleCourse = (course: string) => {
    const current = watchedCourses;
    setValue(
      "recommended_for_courses",
      current.includes(course) ? current.filter((c) => c !== course) : [...current, course]
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-3xl">
      {/* AI Processing — includes the Domain selector (pick before extracting) */}
      <ProcessWithAI
        onProcessed={handleAIProcessed}
        domain={watchedDomain}
        onDomainChange={(d) => setValue("domain", d)}
        onPreviewDuplicate={onPreviewDuplicate}
      />

      {/* Basic info */}
      <Section title="Basic Information">
        <Field label="Laptop Name *" error={errors.name?.message}>
          <Input {...register("name")} placeholder="e.g. ASUS ROG Strix G16 (2024)" className="bg-background/50" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Brand" error={errors.brand?.message}>
            <Input {...register("brand")} placeholder="ASUS, Dell, Lenovo…" className="bg-background/50" />
          </Field>
          <Field label="Model" error={errors.model?.message}>
            <Input {...register("model")} placeholder="ROG Strix G16" className="bg-background/50" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Approx. Price (₹)" error={errors.price_approx?.message}>
            <Input {...register("price_approx", { valueAsNumber: true })} type="number" placeholder="89990" className="bg-background/50" />
          </Field>
          <Field label="Price Label" error={errors.price_label?.message}>
            <Input {...register("price_label")} placeholder="₹89,990" className="bg-background/50" />
          </Field>
        </div>
        <Field label="Amazon Affiliate URL *" error={errors.amazon_affiliate_url?.message}>
          <Input {...register("amazon_affiliate_url")} type="url" placeholder="https://amzn.to/…" className="bg-background/50" />
        </Field>
        <Field label="Image URL" error={errors.image_url?.message}>
          <Input {...register("image_url")} type="url" placeholder="https://…" className="bg-background/50" />
        </Field>
      </Section>

      {/* Specs */}
      <Section title="Specifications">
        <Field label="CPU" error={errors.cpu?.message}>
          <Input {...register("cpu")} placeholder="Intel Core i7-13650HX" className="bg-background/50" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="GPU" error={errors.gpu?.message}>
            <Input {...register("gpu")} placeholder="NVIDIA RTX 4060" className="bg-background/50" />
          </Field>
          <Field label="GPU VRAM (GB)" error={errors.gpu_vram_gb?.message}>
            <Input {...register("gpu_vram_gb")} type="text" placeholder="e.g. 8 or Integrated" className="bg-background/50" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="RAM" error={errors.ram?.message}>
            <Input {...register("ram")} placeholder="16GB DDR5" className="bg-background/50" />
          </Field>
          <Field label="RAM (GB)" error={errors.ram_gb?.message}>
            <Input {...register("ram_gb", { valueAsNumber: true })} type="number" placeholder="16" className="bg-background/50" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Storage" error={errors.storage?.message}>
            <Input {...register("storage")} placeholder="512GB NVMe SSD" className="bg-background/50" />
          </Field>
          <Field label="Storage (GB)" error={errors.storage_gb?.message}>
            <Input {...register("storage_gb", { valueAsNumber: true })} type="number" placeholder="512" className="bg-background/50" />
          </Field>
        </div>
        <Field label="Display" error={errors.display?.message}>
          <Input {...register("display")} placeholder='15.6" FHD 144Hz, 100% sRGB' className="bg-background/50" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Weight" error={errors.weight?.message}>
            <Input {...register("weight")} placeholder="2.2kg" className="bg-background/50" />
          </Field>
          <Field label="OS" error={errors.os?.message}>
            <Input {...register("os")} placeholder="Windows 11 Home" className="bg-background/50" />
          </Field>
        </div>
      </Section>

      {/* Tier */}
      <Section title="Tier">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(TIER_LABELS) as Array<keyof typeof TIER_LABELS>).map((tier) => (
            <button
              key={tier}
              type="button"
              onClick={() => setValue("tier", tier as "budget" | "value" | "balanced" | "advanced" | "premium")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                watch("tier") === tier
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border/60 text-muted-foreground hover:border-border"
              }`}
            >
              {TIER_LABELS[tier]}
            </button>
          ))}
        </div>
      </Section>

      {/* Workload tags */}
      <Section title="Workload Tags">
        <div className="flex flex-wrap gap-2">
          {domainWorkloadTags.map((tag) => (
            <button
              key={tag.value}
              type="button"
              onClick={() => toggleTag(tag.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                watchedTags.includes(tag.value)
                  ? "bg-primary/20 text-primary border-primary/50"
                  : "border-border/60 text-muted-foreground hover:border-border"
              }`}
            >
              {tag.label}
            </button>
          ))}
        </div>
      </Section>

      {/* Recommended courses */}
      <Section title="Recommended For Courses">
        {Object.keys(domainCourses).length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No programmes defined for this domain yet. Add them under{" "}
            <a href="/admin/taxonomy" className="text-primary hover:underline">Taxonomy</a>.
          </p>
        ) : (
        <div className="space-y-3">
          {Object.entries(domainCourses).map(([cat, courses]) => (
            <div key={cat}>
              <p className="text-xs text-muted-foreground mb-1.5">{cat}</p>
              <div className="flex flex-wrap gap-2">
                {courses.map((course) => (
                  <button
                    key={course}
                    type="button"
                    onClick={() => toggleCourse(course)}
                    className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                      watchedCourses.includes(course)
                        ? "bg-primary/20 text-primary border-primary/50"
                        : "border-border/40 text-muted-foreground hover:border-border"
                    }`}
                  >
                    {course}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        )}
      </Section>

      {/* Recommendation text */}
      <Section title="Recommendation Text">
        <Field label="Why Recommended" error={errors.why_recommended?.message}>
          <Textarea {...register("why_recommended")} rows={3} placeholder="Student-friendly explanation of why this laptop suits design work…" className="bg-background/50 resize-y" />
        </Field>
        <Field label="Cautions / Limitations" error={errors.cautions?.message}>
          <Textarea {...register("cautions")} rows={2} placeholder="Honest limitations — weak GPU, soldered RAM, poor thermals, heavy weight…" className="bg-background/50 resize-y" />
        </Field>
        <Field label="Upgrade Notes" error={errors.upgrade_notes?.message}>
          <Textarea {...register("upgrade_notes")} rows={2} placeholder="Upgrade options — upgradeable RAM slot, free M.2 slot…" className="bg-background/50 resize-y" />
        </Field>
      </Section>

      {/* 4-year suitability */}
      <Section title="4-Year Suitability">
        <div className="flex flex-wrap gap-2">
          {(["basic", "good", "strong", "excellent"] as const).map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setValue("four_year_suitability", level)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border capitalize transition-colors ${
                watch("four_year_suitability") === level
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border/60 text-muted-foreground hover:border-border"
              }`}
            >
              {level}
            </button>
          ))}
        </div>
      </Section>

      {/* Priority & publish */}
      <Section title="Priority & Status">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Priority Score (0–100)" error={errors.priority_score?.message}>
            <Input {...register("priority_score", { valueAsNumber: true })} type="number" min={0} max={100} placeholder="50" className="bg-background/50" />
          </Field>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <Switch
            checked={watchedPublished}
            onCheckedChange={(v) => setValue("is_published", v)}
            id="is_published"
          />
          <Label htmlFor="is_published" className="text-sm cursor-pointer">
            {watchedPublished ? "Published (visible to students)" : "Draft (hidden from students)"}
          </Label>
        </div>
      </Section>

      {saveError && (
        <p className="text-xs text-destructive bg-destructive/10 p-3 rounded-lg">{saveError}</p>
      )}

      <div className="flex gap-3">
        <Button
          type="submit"
          disabled={saving}
          className="gap-2 bg-primary text-primary-foreground hover:opacity-90"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Saving…" : laptop ? "Save Changes" : "Create Laptop"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          className="border-border/60"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-card rounded-xl border p-5 space-y-4">
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      {children}
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
