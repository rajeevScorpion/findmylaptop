"use client";

import { useState, useMemo } from "react";
import { Pencil, Laptop, Plus, ChevronUp, ChevronDown, ChevronsUpDown, Info, Search, X, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { PublishToggle } from "@/components/admin/PublishToggle";
import { FeatureToggle } from "@/components/admin/FeatureToggle";
import { InlinePriceEdit } from "@/components/admin/InlinePriceEdit";
import { DeleteLaptopButton } from "@/components/admin/DeleteLaptopButton";
import { LaptopCard } from "@/components/public/LaptopCard";
import { DOMAINS, type DomainId } from "@/lib/domains";
import type { RecommendationResult } from "@/lib/types";

// Per-domain chip styling using each domain's accent (the same oklch hues that
// theme its route via --primary in globals.css): design = orange, technology =
// blue, management = green. Light/dark text variants mirror the CSS overrides.
const DOMAIN_CHIP: Record<DomainId, string> = {
  design:
    "bg-[oklch(0.65_0.17_55_/_0.12)] text-[oklch(0.65_0.17_55)] dark:text-[oklch(0.78_0.15_60)]",
  technology:
    "bg-[oklch(0.55_0.19_255_/_0.12)] text-[oklch(0.55_0.19_255)] dark:text-[oklch(0.72_0.16_255)]",
  management:
    "bg-[oklch(0.56_0.14_162_/_0.12)] text-[oklch(0.56_0.14_162)] dark:text-[oklch(0.72_0.13_162)]",
};

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
  availability?: string | null;
  last_checked?: string | null;
  is_published: boolean;
  feature_on_home: boolean;
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

type SortColumn = "name" | "domain" | "price" | "updated" | "published";
type SortDir = "asc" | "desc";

function isUnavailable(availability: string | null | undefined): boolean {
  if (!availability) return false;
  const l = availability.toLowerCase();
  return l.includes("unavailable") || l.includes("out of stock") || l.includes("not available");
}

function AttentionPanel({ laptops }: { laptops: AdminLaptop[] }) {
  const [open, setOpen] = useState(true);
  if (laptops.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-left"
      >
        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
        <span className="text-sm font-medium text-amber-700 dark:text-amber-400 flex-1">
          {laptops.length} laptop{laptops.length !== 1 ? "s" : ""} auto-unpublished — availability issue detected
        </span>
        <ChevronDown
          className={`w-4 h-4 text-amber-500 transition-transform ${open ? "" : "-rotate-90"}`}
        />
      </button>
      {open && (
        <div className="border-t border-amber-500/20 divide-y divide-amber-500/10">
          {laptops.map((l) => (
            <div key={l.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{l.name}</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                  {l.availability ?? "Unavailable"} · last checked {l.last_checked ?? "—"}
                </p>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <span className="text-xs text-muted-foreground hidden sm:block">Re-publish?</span>
                <PublishToggle laptopId={l.id} initialPublished={false} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PaginationBar({
  pageStart, pageSize, total, page, totalPages, onPrev, onNext,
}: {
  pageStart: number; pageSize: number; total: number;
  page: number; totalPages: number;
  onPrev: () => void; onNext: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <span className="text-xs text-muted-foreground">
        {pageStart + 1}–{Math.min(pageStart + pageSize, total)} of {total}
      </span>
      <div className="flex items-center gap-1.5">
        <button
          onClick={onPrev}
          disabled={page === 0}
          className="inline-flex items-center gap-1 h-7 px-2 text-xs font-medium rounded-md border border-border bg-card hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Prev
        </button>
        <span className="text-xs text-muted-foreground px-1">{page + 1} / {totalPages}</span>
        <button
          onClick={onNext}
          disabled={page === totalPages - 1}
          className="inline-flex items-center gap-1 h-7 px-2 text-xs font-medium rounded-md border border-border bg-card hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function SortIcon({ column, sort }: { column: SortColumn; sort: { col: SortColumn; dir: SortDir } | null }) {
  if (!sort || sort.col !== column) return <ChevronsUpDown className="w-3 h-3 opacity-40" />;
  return sort.dir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
}

export function LaptopListWithPreview({ laptops }: LaptopListWithPreviewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sort, setSort] = useState<{ col: SortColumn; dir: SortDir } | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  function toggleSort(col: SortColumn) {
    setPage(0);
    setSort((prev) =>
      prev?.col === col
        ? prev.dir === "asc"
          ? { col, dir: "desc" }
          : null
        : { col, dir: "asc" }
    );
  }

  function handleQuery(v: string) {
    setQuery(v);
    setPage(0);
  }

  const sorted = useMemo(() => {
    if (!sort) return laptops;
    return [...laptops].sort((a, b) => {
      let cmp = 0;
      if (sort.col === "name") cmp = a.name.localeCompare(b.name);
      else if (sort.col === "domain") cmp = (a.domain ?? "design").localeCompare(b.domain ?? "design");
      else if (sort.col === "price") cmp = (a.price_approx ?? 0) - (b.price_approx ?? 0);
      else if (sort.col === "updated") cmp = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
      else if (sort.col === "published") cmp = Number(a.is_published) - Number(b.is_published);
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [laptops, sort]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        (l.brand ?? "").toLowerCase().includes(q)
    );
  }, [sorted, query]);

  const PAGE_SIZE = 15;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageStart = safePage * PAGE_SIZE;
  const paginated = useMemo(
    () => filtered.slice(pageStart, pageStart + PAGE_SIZE),
    [filtered, pageStart]
  );

  const attentionLaptops = useMemo(
    () => laptops.filter((l) => !l.is_published && l.last_checked && isUnavailable(l.availability)),
    [laptops]
  );

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
      <div className="flex-1 min-w-0 space-y-3">
        <AttentionPanel laptops={attentionLaptops} />
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name or brand…"
            value={query}
            onChange={(e) => handleQuery(e.target.value)}
            className="w-full h-8 pl-8 pr-8 text-sm rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          {query && (
            <button
              onClick={() => handleQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {totalPages > 1 && (
          <PaginationBar
            pageStart={pageStart}
            pageSize={PAGE_SIZE}
            total={filtered.length}
            page={safePage}
            totalPages={totalPages}
            onPrev={() => setPage((p) => Math.max(0, p - 1))}
            onNext={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          />
        )}
        <div className="glass-card rounded-xl border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/30 text-xs text-muted-foreground">
                {(["name", "domain", "price", "updated", "published"] as SortColumn[]).map((col) => {
                  const labels: Record<SortColumn, string> = { name: "Name", domain: "Domain", price: "Price", updated: "Updated", published: "Published" };
                  const hidden: Record<SortColumn, string> = { name: "", domain: "", price: "hidden sm:table-cell", updated: "hidden md:table-cell", published: "" };
                  const align: Record<SortColumn, string> = { name: "text-left", domain: "text-left", price: "text-left", updated: "text-left", published: "text-center" };
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
                <th className="text-center px-4 py-3 font-medium hidden sm:table-cell">Featured</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No laptops match &ldquo;{query}&rdquo;
                  </td>
                </tr>
              )}
              {paginated.map((laptop) => {
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
                    <td className="px-4 py-3">
                      {(() => {
                        const d = (laptop.domain ?? "design") as DomainId;
                        return (
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${DOMAIN_CHIP[d]}`}
                          >
                            {DOMAINS[d].label}
                          </span>
                        );
                      })()}
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
                      className="px-4 py-3 text-center hidden sm:table-cell"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <FeatureToggle
                        laptopId={laptop.id}
                        initialFeatured={laptop.feature_on_home}
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
          {totalPages > 1 && (
            <div className="border-t border-border/30">
              <PaginationBar
                pageStart={pageStart}
                pageSize={PAGE_SIZE}
                total={filtered.length}
                page={safePage}
                totalPages={totalPages}
                onPrev={() => setPage((p) => Math.max(0, p - 1))}
                onNext={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              />
            </div>
          )}
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
