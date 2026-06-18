import Link from "next/link";
import { Cpu } from "lucide-react";
import { cn } from "@/lib/utils";

interface SiteHeaderProps {
  /** Show the right-side call-to-action that links to the landing page. */
  showCta?: boolean;
  className?: string;
}

/**
 * Minimal "Lf" wordmark used across the site. No background — just the logo,
 * with an optional CTA on the right (used on blog pages to send readers home).
 */
export function SiteHeader({ showCta = false, className }: SiteHeaderProps) {
  return (
    <header className={cn("flex items-center justify-between gap-4", className)}>
      <Link href="/" aria-label="LaptopFinder — home" className="select-none">
        {/* Matches the favicon (src/app/icon.tsx) exactly */}
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#F97316] text-[17px] font-bold leading-none tracking-[-0.5px] text-white">
          Lf
        </span>
      </Link>

      {showCta && (
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-lg h-9 px-3.5 text-sm font-medium bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity"
        >
          <Cpu className="w-4 h-4" />
          Find My Laptop
        </Link>
      )}
    </header>
  );
}
