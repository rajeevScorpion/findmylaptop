import Link from "next/link";
import { BookOpenCheck } from "lucide-react";

export function AdminGuideLink({
  section,
  label = "View guide",
}: {
  section: string;
  label?: string;
}) {
  return (
    <Link
      href={`/admin/guide#${section}`}
      className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-border bg-card/70 px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <BookOpenCheck className="h-4 w-4 text-primary" aria-hidden="true" />
      {label}
    </Link>
  );
}
