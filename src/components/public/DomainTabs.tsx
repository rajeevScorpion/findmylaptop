import Link from "next/link";
import { DOMAIN_ORDER, type DomainId } from "@/lib/domains";

interface DomainTabsProps {
  /** The domain currently being viewed. */
  activeId: DomainId;
  /** Which domains are currently enabled (Design is always enabled). */
  enabledIds: DomainId[];
}

// Tab bar shown above the finder. Tabs are real <Link>s between the per-domain
// routes (good for SEO + shareability). Rendered only when more than one domain
// is enabled, so the Design-only site looks exactly as it did before.
export function DomainTabs({ activeId, enabledIds }: DomainTabsProps) {
  const tabs = DOMAIN_ORDER.filter((d) => enabledIds.includes(d.id));
  if (tabs.length < 2) return null;

  return (
    <nav
      aria-label="Audience domain"
      className="px-4 pt-8 max-w-5xl mx-auto w-full"
    >
      <div className="inline-flex flex-wrap items-center gap-1 rounded-full glass-card border p-1">
        {tabs.map((d) => {
          const isActive = d.id === activeId;
          return (
            <Link
              key={d.id}
              href={d.route}
              aria-current={isActive ? "page" : undefined}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {d.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
