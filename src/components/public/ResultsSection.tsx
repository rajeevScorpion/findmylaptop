"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { LazyMotion, domAnimation, m } from "framer-motion";
import { Laptop, SlidersHorizontal, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { LaptopCard } from "./LaptopCard";
import { GuidedFinder } from "./GuidedFinder";
import { ComparePanel } from "./ComparePanel";
import type { Laptop as LaptopType, FilterState, RecommendationResult, SortOption } from "@/lib/types";
import { getRecommendations } from "@/lib/recommendationEngine";
import { SORT_OPTIONS } from "@/lib/constants";

interface ResultsSectionProps {
  laptops: LaptopType[];
}

const DEFAULT_FILTERS: FilterState = {
  workloadTags: [],
  searchQuery: "",
};

export function ResultsSection({ laptops }: ResultsSectionProps) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<SortOption>("recommended");
  const [compareList, setCompareList] = useState<RecommendationResult[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [page, setPage] = useState(1);
  const resultsRef = useRef<HTMLElement>(null);

  const scrollToResults = () => {
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const PAGE_SIZE = 9;

  const results = useMemo(
    () => getRecommendations(laptops, filters, sort),
    [laptops, filters, sort]
  );

  const totalPages = Math.ceil(results.length / PAGE_SIZE);
  const paginated = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset to page 1 when filters or sort change
  useEffect(() => { setPage(1); }, [filters, sort]);

  const handleFilterChange = useCallback((f: FilterState) => {
    setFilters(f);
  }, []);

  const handleCompareToggle = useCallback((laptop: RecommendationResult) => {
    setCompareList((prev) => {
      const exists = prev.some((l) => l.id === laptop.id);
      if (exists) {
        const next = prev.filter((l) => l.id !== laptop.id);
        if (next.length === 0) setShowCompare(false);
        return next;
      }
      if (prev.length >= 3) return prev;
      const next = [...prev, laptop];
      setShowCompare(true);
      return next;
    });
  }, []);

  return (
    <>
      <GuidedFinder onFilterChange={handleFilterChange} />

      <section id="results" ref={resultsRef} className="px-4 pb-12 max-w-5xl mx-auto w-full">
        {/* Results header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Laptop className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {results.length} laptop{results.length !== 1 ? "s" : ""} found
            </span>
          </div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
            <Select
              value={sort}
              onValueChange={(v) => setSort(v as SortOption)}
            >
              <SelectTrigger className="h-8 text-xs w-[160px] border-border/60 bg-background/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground/60 mb-5">
          Prices may vary. For the latest price, click <span className="italic">See on Amazon</span>.
        </p>

        {/* Results grid */}
        {results.length > 0 ? (
          <>
            <LazyMotion features={domAnimation}>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {paginated.map((laptop, i) => (
                  <m.div
                    key={laptop.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: Math.min(i * 0.06, 0.4) }}
                  >
                    <LaptopCard
                      laptop={laptop}
                      onCompareToggle={handleCompareToggle}
                      isInCompare={compareList.some((l) => l.id === laptop.id)}
                    />
                  </m.div>
                ))}
              </div>
            </LazyMotion>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-10">
                {/* Prev */}
                <button
                  onClick={() => { setPage((p) => p - 1); scrollToResults(); }}
                  disabled={page === 1}
                  className="w-9 h-9 rounded-full border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-border transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Page numbers */}
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => { setPage(p); scrollToResults(); }}
                    className={`w-9 h-9 rounded-full border text-sm font-medium transition-colors ${
                      p === page
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border/60 text-muted-foreground hover:text-foreground hover:border-border"
                    }`}
                  >
                    {p}
                  </button>
                ))}

                {/* Next */}
                <button
                  onClick={() => { setPage((p) => p + 1); scrollToResults(); }}
                  disabled={page === totalPages}
                  className="w-9 h-9 rounded-full border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-border transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        ) : (
          <EmptyState />
        )}
      </section>

      {/* Compare panel */}
      {compareList.length > 0 && (
        <ComparePanel
          laptops={compareList}
          open={showCompare}
          onOpenChange={setShowCompare}
          onRemove={(id) =>
            setCompareList((prev) => {
              const next = prev.filter((l) => l.id !== id);
              if (next.length === 0) setShowCompare(false);
              return next;
            })
          }
        />
      )}
    </>
  );
}

function EmptyState() {
  return (
    <div className="glass-card rounded-2xl p-12 border text-center space-y-3">
      <Laptop className="w-10 h-10 text-muted-foreground mx-auto" />
      <p className="font-medium text-foreground">No laptops match your filters</p>
      <p className="text-sm text-muted-foreground">
        Try adjusting your budget, removing workload filters, or broadening your search.
      </p>
    </div>
  );
}

export function ResultsSkeleton() {
  return (
    <div className="px-4 pb-12 max-w-5xl mx-auto w-full">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="glass-card rounded-2xl p-5 border space-y-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 4 }).map((_, j) => (
                <Skeleton key={j} className="h-8" />
              ))}
            </div>
            <Skeleton className="h-16" />
            <Skeleton className="h-9" />
          </div>
        ))}
      </div>
    </div>
  );
}
