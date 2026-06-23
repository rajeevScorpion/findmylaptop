"use client";

import { useState, useMemo } from "react";
import { Pencil, Laptop, Plus, ChevronUp, ChevronDown, ChevronsUpDown, Info } from "lucide-react";
import { PublishToggle } from "@/components/admin/PublishToggle";
import { InlinePriceEdit } from "@/components/admin/InlinePriceEdit";
import { DeleteLaptopButton } from "@/components/admin/DeleteLaptopButton";
import { LaptopCard } from "@/components/public/LaptopCard";
import type { RecommendationResult } from "@/lib/types";

// Minimal shape we need from the DB for the list + preview
export interface AdminLaptop {
  id: string;
  slug: string;
  domain?: "design" | "technology" | "management";
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
    domain: laptop.domain ?? "design",
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

type SortColumn = "name" | "price" | "updated" | "published";
type SortDir = "asc" | "desc";

function SortIcon({ column, sort }: { column: SortColumn; sort: { col: SortColumn; dir: SortDir } | null }) {
  if (!sort || sort.col !== column) return <ChevronsUpDown className="w-3 h-3 opacity-40" />;
  return sort.dir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
}

export function LaptopListWithPreview({ laptops }: LaptopListWithPreviewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sort, setSort] = useState<{ col: SortColumn; dir: SortDir } | null>(null);

  function toggleSort(col: SortColumn) {
    setSort((prev) =>
      prev?.col === col
        ? prev.dir === "asc"
          ? { col, dir: "desc" }
          : null
        : { col, dir: "asc" }
    );
  }

  const sorted = useMemo(() => {
    if (!sort) return laptops;
    return [...laptops].sort((a, b) => {
      let cmp = 0;
      if (sort.col === "name") cmp = a.name.localeCompare(b.name);
      else if (sort.col === "price") cmp = (a.price_approx ?? 0) - (b.price_approx ?? 0);
      else if (sort.col === "updated") cmp = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
      else if (sort.col === "published") cmp = Number(a.is_published) - Number(b.is_published);
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [laptops, sort]);

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
                {(["name", "price", "updated", "published"] as SortColumn[]).map((col) => {
                  const labels: Record<SortColumn, string> = { name: "Name", price: "Price", updated: "Updated", published: "Published" };
                  const hidden: Record<SortColumn, string> = { name: "", price: "hidden sm:table-cell", updated: "hidden md:table-cell", published: "" };
                  const align: Record<SortColumn, string> = { name: "text-left", price: "text-left", updated: "text-left", published: "text-center" };
                  return (
                    <th key={col} className={`px-4 py-3 font-medium ${hidden[col]}`}>
                      <span className={`inline-flex items-center gap-1 ${align[col] === "text-center" ? "mx-auto" : ""}`}>
                        <button
                          onClick={() => toggleSort(col)}
                          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                        >
                          {labels[col]}
                          <SortIcon column={col} sort={sort} />
                        </button>
                        {col === "price" && (
                          <Info
                            className="w-3 h-3 opacity-50 hover:opacity-90 transition-opacity cursor-help"
                            aria-label="Click a price to edit it"
                          >
                            <title>Click a price to edit it</title>
                          </Info>
                        )}
                      </span>
                    </th>
                  );
                })}
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {sorted.map((laptop) => {
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
                    <td
                      className="px-4 py-3 hidden sm:table-cell"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <InlinePriceEdit
                        laptopId={laptop.id}
                        initialPrice={laptop.price_approx ?? null}
                        initialLabel={laptop.price_label ?? null}
                      />
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

      {/* Preview panel — sticky; grows to the card's natural height and
          stays pinned while the page scrolls */}
      {selected && (
        <div className="w-80 shrink-0 sticky top-6">
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
