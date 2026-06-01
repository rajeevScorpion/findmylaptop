"use client";

import { useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FilterState } from "@/lib/types";
import { COURSES_BY_CATEGORY, BUDGET_RANGES, WORKLOAD_TAGS } from "@/lib/constants";

interface GuidedFinderProps {
  onFilterChange: (filters: FilterState) => void;
}

const DEFAULT_FILTERS: FilterState = {
  course: undefined,
  courseCategory: undefined,
  maxBudget: undefined,
  minRamGb: undefined,
  minVramGb: undefined,
  tier: undefined,
  workloadTags: [],
  searchQuery: "",
};

export function GuidedFinder({ onFilterChange }: GuidedFinderProps) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const update = (patch: Partial<FilterState>) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    onFilterChange(next);
  };

  const reset = () => {
    setFilters(DEFAULT_FILTERS);
    onFilterChange(DEFAULT_FILTERS);
  };

  const hasActiveFilters =
    filters.course ||
    filters.maxBudget ||
    filters.workloadTags.length > 0 ||
    filters.searchQuery ||
    filters.minRamGb ||
    filters.minVramGb;

  return (
    <section id="finder" className="px-4 py-10 max-w-5xl mx-auto w-full">
      <div className="glass-card rounded-2xl p-6 border space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Find your laptop</h2>
            <p className="text-sm text-muted-foreground">Filter by course, budget, and workload</p>
            <p className="text-xs text-muted-foreground/70 leading-relaxed mt-0.5">Every laptop listed here is hand-picked based on real course requirements and years of experience guiding design students.</p>
          </div>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={reset} className="gap-1.5 text-xs text-muted-foreground">
              <X className="w-3.5 h-3.5" /> Clear all
            </Button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by course, brand, or GPU…"
            value={filters.searchQuery}
            onChange={(e) => update({ searchQuery: e.target.value })}
            className="pl-10 h-12 rounded-full bg-background/50 border-border/60"
          />
        </div>

        {/* Course category */}
        <div>
          <p className="text-xs font-semibold text-foreground mb-2 uppercase tracking-widest">Your Course</p>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {Object.keys(COURSES_BY_CATEGORY).map((cat) => (
                <button
                  key={cat}
                  onClick={() =>
                    update({
                      courseCategory: filters.courseCategory === cat ? undefined : cat,
                      course: undefined,
                    })
                  }
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    filters.courseCategory === cat
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {filters.courseCategory && (
              <div className="flex flex-wrap gap-2 pl-2">
                {(COURSES_BY_CATEGORY[filters.courseCategory] ?? []).map((course) => (
                  <button
                    key={course}
                    onClick={() =>
                      update({ course: filters.course === course ? undefined : course })
                    }
                    className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                      filters.course === course
                        ? "bg-primary/20 text-primary border-primary/50"
                        : "border-border/40 text-muted-foreground hover:border-border hover:text-foreground"
                    }`}
                  >
                    {course}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Advanced toggle */}
        <div>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            {showAdvanced ? "Hide" : "Show"} advanced filters
          </button>
        </div>

        {showAdvanced && (
          <div className="space-y-4 pt-1 border-t border-border/30">
            {/* Budget */}
            <div>
              <p className="text-xs font-semibold text-foreground mb-2 uppercase tracking-widest">Budget</p>
              <div className="flex flex-wrap gap-2">
                {BUDGET_RANGES.map((range) => (
                  <button
                    key={range.value}
                    onClick={() =>
                      update({ maxBudget: filters.maxBudget === range.value ? undefined : range.value })
                    }
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      filters.maxBudget === range.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground"
                    }`}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Workload tags */}
            <div>
              <p className="text-xs font-semibold text-foreground mb-2 uppercase tracking-widest">Workload</p>
              <div className="flex flex-wrap gap-2">
                {WORKLOAD_TAGS.map((tag) => (
                  <button
                    key={tag.value}
                    onClick={() => {
                      const tags = filters.workloadTags.includes(tag.value)
                        ? filters.workloadTags.filter((t) => t !== tag.value)
                        : [...filters.workloadTags, tag.value];
                      update({ workloadTags: tags });
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      filters.workloadTags.includes(tag.value)
                        ? "bg-primary/20 text-primary border-primary/50"
                        : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground"
                    }`}
                  >
                    {tag.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Min RAM + Min VRAM — side by side on desktop */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <p className="text-xs font-semibold text-foreground mb-2 uppercase tracking-widest">Minimum RAM</p>
                <div className="flex flex-wrap gap-2">
                  {[8, 16, 24, 32].map((gb) => (
                    <button
                      key={gb}
                      onClick={() =>
                        update({ minRamGb: filters.minRamGb === gb ? undefined : gb })
                      }
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        filters.minRamGb === gb
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground"
                      }`}
                    >
                      {gb}GB+
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1">
                <p className="text-xs font-semibold text-foreground mb-2 uppercase tracking-widest">Minimum GPU VRAM</p>
                <div className="flex flex-wrap gap-2">
                  {[4, 6, 8, 12].map((gb) => (
                    <button
                      key={gb}
                      onClick={() =>
                        update({ minVramGb: filters.minVramGb === gb ? undefined : gb })
                      }
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        filters.minVramGb === gb
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground"
                      }`}
                    >
                      {gb}GB+
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </section>
  );
}
