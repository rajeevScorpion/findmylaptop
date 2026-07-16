"use client";

import { useEffect, useState } from "react";
import type {
  AffiliateCtaMetadata,
  AffiliatePriceMetadata,
} from "@/lib/affiliate/public";

interface AffiliateCtaDetailsProps {
  cta: AffiliateCtaMetadata;
  compact?: boolean;
  showDisclosure?: boolean;
}

function sourceBadge(sourceKey: string): string {
  if (sourceKey === "amazon") return "Amazon";
  if (sourceKey === "flipkart") return "Flipkart";
  return "Other";
}

function stillFresh(validUntil: string, now: number): boolean {
  const expiresAt = new Date(validUntil).getTime();
  return Number.isFinite(expiresAt) && expiresAt >= now;
}

function formatPrice(price: AffiliatePriceMetadata): string {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: price.currency,
      maximumFractionDigits: 0,
    }).format(price.amount);
  } catch {
    return `${price.currency} ${price.amount.toLocaleString("en-IN")}`;
  }
}

function formatEvidenceTime(value: string): string {
  return new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

export function AffiliateCtaDetails({
  cta,
  compact = false,
  showDisclosure = true,
}: AffiliateCtaDetailsProps) {
  const [price, setPrice] = useState<AffiliatePriceMetadata | null>(null);

  useEffect(() => {
    const now = Date.now();
    setPrice(cta.price && stillFresh(cta.price.validUntil, now) ? cta.price : null);
  }, [cta]);

  const textSize = compact ? "text-[9px]" : "text-[10px]";

  return (
    <div className={`space-y-1 leading-relaxed text-muted-foreground ${textSize}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          title={cta.sourceName}
          className="rounded-full border border-border/60 px-1.5 py-0.5 font-medium text-foreground/80"
        >
          {sourceBadge(cta.sourceKey)}
        </span>
        {price && <span>{formatPrice(price)}</span>}
        {price && <span>Updated {formatEvidenceTime(price.fetchedAt)} IST</span>}
      </div>
      {showDisclosure && <p>{cta.disclosure}</p>}
    </div>
  );
}
