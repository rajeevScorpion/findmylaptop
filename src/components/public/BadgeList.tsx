import type { BadgeType } from "@/lib/types";

const BADGE_STYLES: Record<BadgeType, string> = {
  "Best Value": "badge-best-value",
  "Future Ready": "badge-future-ready",
  "Heavy 3D": "badge-heavy-3d",
  "AI Ready": "badge-ai-ready",
  "Portable Choice": "badge-portable",
  "Budget Conscious": "badge-budget",
};

interface BadgeListProps {
  badges: BadgeType[];
  className?: string;
}

export function BadgeList({ badges, className = "" }: BadgeListProps) {
  if (!badges.length) return null;

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {badges.map((badge) => (
        <span
          key={badge}
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${BADGE_STYLES[badge]}`}
        >
          {badge}
        </span>
      ))}
    </div>
  );
}
