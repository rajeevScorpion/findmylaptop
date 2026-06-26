"use client";

import { useEffect, useState } from "react";
import { Loader2, ExternalLink, Eye } from "lucide-react";
import { LaptopForm } from "./LaptopForm";
import { LaptopCard } from "@/components/public/LaptopCard";
import { createClient } from "@/lib/supabase/client";
import type { DomainId } from "@/lib/domains";
import type { DomainTaxonomy } from "@/lib/taxonomy";
import type { Laptop, RecommendationResult } from "@/lib/types";

interface AddLaptopWorkspaceProps {
  taxonomies: Record<DomainId, DomainTaxonomy>;
}

/**
 * Two-column add-laptop screen: the form on the left, and a live preview of any
 * suggested duplicate on the right. Clicking a duplicate in "Fetch & Extract"
 * loads that existing laptop's card here (instead of navigating away) so the
 * admin can eyeball whether it's really the same machine before adding.
 */
export function AddLaptopWorkspace({ taxonomies }: AddLaptopWorkspaceProps) {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [laptop, setLaptop] = useState<Laptop | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!previewId) {
      setLaptop(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLaptop(null);

    const supabase = createClient();
    supabase
      .from("laptops")
      .select("*")
      .eq("id", previewId)
      .single()
      .then(({ data }) => {
        if (cancelled) return;
        setLaptop((data as Laptop) ?? null);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [previewId]);

  // LaptopCard expects a RecommendationResult; for a plain preview we don't need
  // scoring or badges, and compare is a no-op here.
  const previewResult: RecommendationResult | null = laptop
    ? { ...laptop, suitabilityScore: 0, badges: [] }
    : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] items-start">
      <LaptopForm taxonomies={taxonomies} onPreviewDuplicate={setPreviewId} />

      <aside className="lg:sticky lg:top-6">
        {previewResult ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" />
                Possible duplicate
              </p>
              <a
                href={`/admin/laptops/${previewResult.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Edit entry
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <LaptopCard
              laptop={previewResult}
              onCompareToggle={() => {}}
              isInCompare={false}
            />
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-56 rounded-2xl border border-dashed border-border/50 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 h-56 rounded-2xl border border-dashed border-border/50 text-center px-6">
            <Eye className="w-5 h-5 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground/70">
              When Fetch &amp; Extract finds a possible duplicate, click it to preview the existing laptop card here.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
