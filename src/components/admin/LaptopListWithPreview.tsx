"use client";

import { useState } from "react";
import { Pencil, Laptop, Plus } from "lucide-react";
import { PublishToggle } from "@/components/admin/PublishToggle";
import { DeleteLaptopButton } from "@/components/admin/DeleteLaptopButton";
import { LaptopCard } from "@/components/public/LaptopCard";
import type { RecommendationResult } from "@/lib/types";

// Minimal shape we need from the DB for the list + preview
export interface AdminLaptop {
  id: string;
  slug: string;
  name: string;
  brand?: string | null;
  model?: string | null;
  price_approx?: number | null;
  price_label?: string | null;
  amazon_affiliate_url: string;
  image_url?: string | null;
  cpu?: string | null;
  gpu?: string | null;
  gpu_vram_gb?: number | null;
  ram?: string | null;
  ram_gb?: number | null;
  storage?: string | null;
  storage_gb?: number | null;
  display?: string | null;
  weight?: string | null;
  os?: string | null;
  tier?: "budget" | "value" | "balanced" | "advanced" | "premium" | null;
  workload_tags: string[];
  recommended_for_courses: string[];
  not_ideal_for: string[];
  why_recommended?: string | null;
  cautions?: string | null;
  upgrade_notes?: string | null;
  four_year_suitability?: "basic" | "good" | "strong" | "excellent" | null;
  priority_score: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

function toPreviewResult(laptop: AdminLaptop): RecommendationResult {
  return {
    ...laptop,
    last_checked: null,
    raw_input: null,
    openai_processed_json: null,
    created_by: null,
    suitabilityScore: 0,
    badges: [],
  };
}

interface LaptopListWithPreviewProps {
  laptops: AdminLaptop[];
}

export function LaptopListWithPreview({ laptops }: LaptopListWithPreviewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = laptops.find((l) => l.id === selectedId) ?? null;

  if (laptops.length === 0) {
    return (
      <div className="glass-card rounded-xl border p-10 text-center space-y-3">
        <Laptop className="w-8 h-8 text-muted-foreground mx-auto" />
        <p className="text-sm font-medium text-foreground">No laptops yet</p>
        <p className="text-xs text-muted-foreground">
          Add your first laptop recommendation to get started.
        </p>
        <a
          href="/admin/laptops/new"
          className="inline-flex items-center gap-1.5 rounded-[min(var(--radius-md),12px)] h-7 px-2.5 text-[0.8rem] font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          Add Laptop
        </a>
      </div>
    );
  }

  return (
    <div className="flex gap-6 items-start">
      {/* Table */}
      <div className="flex-1 min-w-0">
        <div className="glass-card rounded-xl border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/30 text-xs text-muted-foreground">
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Price</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Updated</th>
                <th className="text-center px-4 py-3 font-medium">Published</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {laptops.map((laptop) => {
                const isSelected = laptop.id === selectedId;
                return (
                  <tr
                    key={laptop.id}
                    onClick={() => setSelectedId(isSelected ? null : laptop.id)}
                    className={`cursor-pointer transition-colors select-none ${
                      isSelected
                        ? "bg-primary/8 border-l-[3px] border-l-primary"
                        : "hover:bg-muted/10"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{laptop.name}</p>
                        {laptop.brand && (
                          <p className="text-xs text-muted-foreground">{laptop.brand}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-sm text-foreground">{laptop.price_label ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs text-muted-foreground">
                        {new Date(laptop.updated_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    </td>
                    <td
                      className="px-4 py-3 text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <PublishToggle
                        laptopId={laptop.id}
                        initialPublished={laptop.is_published}
                      />
                    </td>
                    <td
                      className="px-4 py-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={`/admin/laptops/${laptop.id}`}
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground h-7 px-2 rounded-md hover:bg-muted/40 transition-colors"
                        >
                          <Pencil className="w-3 h-3" />
                          Edit
                        </a>
                        <DeleteLaptopButton laptopId={laptop.id} laptopName={laptop.name} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!selected && (
          <p className="text-xs text-muted-foreground/50 mt-3 text-center">
            Click a row to preview the card
          </p>
        )}
      </div>

      {/* Preview panel */}
      {selected && (
        <div className="w-72 shrink-0 sticky top-6">
          <LaptopCard
            laptop={toPreviewResult(selected)}
            onCompareToggle={() => {}}
            isInCompare={false}
          />
        </div>
      )}
    </div>
  );
}
