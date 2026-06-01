"use client";

import { X, ExternalLink } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { RecommendationResult } from "@/lib/types";
import { FOUR_YEAR_LABELS } from "@/lib/constants";

interface ComparePanelProps {
  laptops: RecommendationResult[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRemove: (id: string) => void;
}

type RowDef = {
  key: keyof RecommendationResult;
  label: string;
  format?: (v: unknown) => string;
};

const ROWS: RowDef[] = [
  { key: "price_label", label: "Price" },
  { key: "cpu", label: "CPU" },
  { key: "gpu", label: "GPU" },
  { key: "gpu_vram_gb", label: "VRAM", format: (v) => v ? `${v}GB` : "—" },
  { key: "ram", label: "RAM" },
  { key: "storage", label: "Storage" },
  { key: "display", label: "Display" },
  { key: "weight", label: "Weight" },
  { key: "four_year_suitability", label: "4-Year", format: (v) => typeof v === "string" ? (FOUR_YEAR_LABELS[v] ?? v) : "—" },
  { key: "tier", label: "Tier" },
];

export function ComparePanel({ laptops, open, onOpenChange, onRemove }: ComparePanelProps) {
  return (
    <>
      {/* Sticky trigger bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 glass-card border-t border-border/40 backdrop-blur-md">
        <span className="text-sm font-medium text-foreground">
          {laptops.length} laptop{laptops.length !== 1 ? "s" : ""} in compare
        </span>
        <Button
          size="sm"
          onClick={() => onOpenChange(true)}
          className="gap-1.5 bg-primary text-primary-foreground hover:opacity-90"
        >
          Compare now
        </Button>
      </div>

      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="h-[85vh] overflow-y-auto bg-background border-t border-border/60 px-4 pb-8"
        >
          <SheetHeader className="mb-4">
            <SheetTitle className="text-foreground">Compare Laptops</SheetTitle>
          </SheetHeader>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr>
                  <th className="text-left text-xs text-muted-foreground font-normal pb-3 w-24 pr-3">
                    Spec
                  </th>
                  {laptops.map((laptop) => (
                    <th key={laptop.id} className="text-left pb-3 pr-4 align-top">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-foreground leading-tight">
                          {laptop.name}
                        </p>
                        <button
                          onClick={() => onRemove(laptop.id)}
                          className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors"
                        >
                          <X className="w-3 h-3" /> Remove
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map(({ key, label, format }) => (
                  <tr key={key} className="border-t border-border/20">
                    <td className="py-2.5 pr-3 text-xs text-muted-foreground align-top">
                      {label}
                    </td>
                    {laptops.map((laptop) => {
                      const raw = laptop[key as keyof RecommendationResult];
                      const display = format
                        ? (format as (v: unknown) => string)(raw)
                        : (raw as string | null | undefined) ?? "—";
                      return (
                        <td key={laptop.id} className="py-2.5 pr-4 text-xs text-foreground align-top">
                          {display || "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {/* Cautions row */}
                <tr className="border-t border-border/20">
                  <td className="py-2.5 pr-3 text-xs text-muted-foreground align-top">
                    Cautions
                  </td>
                  {laptops.map((laptop) => (
                    <td key={laptop.id} className="py-2.5 pr-4 text-xs text-amber-300/80 align-top">
                      {laptop.cautions ?? "—"}
                    </td>
                  ))}
                </tr>
                {/* Buy links row */}
                <tr className="border-t border-border/20">
                  <td className="py-2.5 pr-3 text-xs text-muted-foreground align-top">
                    Buy
                  </td>
                  {laptops.map((laptop) => (
                    <td key={laptop.id} className="py-2.5 pr-4 align-top">
                      <a
                        href={laptop.amazon_affiliate_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Amazon
                      </a>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
