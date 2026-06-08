import { createClient } from "@/lib/supabase/server";
import { Laptop, CheckCircle2, FileText, Plus } from "lucide-react";
import { COURSES_BY_CATEGORY, TIER_LABELS } from "@/lib/constants";

const TIER_PILL_COLORS: Record<string, string> = {
  budget:   "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  value:    "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  balanced: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  advanced: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  premium:  "bg-pink-500/15 text-pink-700 dark:text-pink-400",
};

const TIER_ORDER = ["budget", "value", "balanced", "advanced", "premium"];

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const { data: laptops } = await supabase
    .from("laptops")
    .select("id, is_published, updated_at, name, recommended_for_courses, tier")
    .order("updated_at", { ascending: false });

  const total = laptops?.length ?? 0;
  const published = laptops?.filter((l) => l.is_published).length ?? 0;
  const drafts = total - published;

  const lastUpdated = laptops?.[0]
    ? new Date(laptops[0].updated_at).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

  // Build course coverage from published laptops only
  const coverage: Record<string, { count: number; tiers: Set<string> }> = {};
  for (const courses of Object.values(COURSES_BY_CATEGORY)) {
    for (const course of courses) {
      coverage[course] = { count: 0, tiers: new Set() };
    }
  }
  for (const laptop of laptops?.filter((l) => l.is_published) ?? []) {
    for (const course of laptop.recommended_for_courses ?? []) {
      if (coverage[course]) {
        coverage[course].count++;
        if (laptop.tier) coverage[course].tiers.add(laptop.tier);
      }
    }
  }

  const totalCourses = Object.keys(coverage).length;
  const coveredCourses = Object.values(coverage).filter((c) => c.count > 0).length;

  const STATS = [
    { label: "Total Laptops", value: total, icon: <Laptop className="w-5 h-5 text-primary" /> },
    { label: "Published", value: published, icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" /> },
    { label: "Drafts", value: drafts, icon: <FileText className="w-5 h-5 text-amber-400" /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Last updated: {lastUpdated}</p>
        </div>
        <a
          href="/admin/laptops/new"
          className="inline-flex items-center gap-1.5 rounded-[min(var(--radius-md),12px)] h-7 px-2.5 text-[0.8rem] font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          Add Laptop
        </a>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {STATS.map(({ label, value, icon }) => (
          <div key={label} className="glass-card rounded-xl border p-5 flex items-center gap-4">
            {icon}
            <div>
              <p className="text-2xl font-bold text-foreground">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      {/* Course coverage */}
      <div className="glass-card rounded-xl border overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border/30 flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">Course Coverage</p>
          <p className="text-xs text-muted-foreground">
            {coveredCourses}/{totalCourses} courses covered
          </p>
        </div>

        <div className="divide-y divide-border/20">
          {Object.entries(COURSES_BY_CATEGORY).map(([category, courses]) => (
            <div key={category}>
              <p className="px-5 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                {category}
              </p>
              {courses.map((course) => {
                const { count, tiers } = coverage[course] ?? { count: 0, tiers: new Set() };
                const countColor =
                  count >= 3
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                    : count >= 1
                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                    : "bg-red-500/15 text-red-600 dark:text-red-400";

                return (
                  <div
                    key={course}
                    className="flex items-center justify-between px-5 py-2.5 hover:bg-muted/10 transition-colors"
                  >
                    <a
                      href="/admin/laptops"
                      className="text-sm text-foreground hover:text-primary transition-colors"
                    >
                      {course}
                    </a>
                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      {/* Tier pills */}
                      <div className="hidden sm:flex items-center gap-1">
                        {TIER_ORDER.filter((t) => tiers.has(t)).map((tier) => (
                          <span
                            key={tier}
                            className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${TIER_PILL_COLORS[tier]}`}
                          >
                            {TIER_LABELS[tier]}
                          </span>
                        ))}
                      </div>
                      {/* Count badge */}
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full min-w-[2rem] text-center ${countColor}`}>
                        {count}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Recent laptops */}
      {laptops && laptops.length > 0 && (
        <div className="glass-card rounded-xl border overflow-hidden sticky top-6">
          <div className="px-4 py-3 border-b border-border/30">
            <p className="text-sm font-medium text-foreground">Recent laptops</p>
          </div>
          <div className="divide-y divide-border/20">
            {laptops.slice(0, 8).map((laptop) => (
              <div key={laptop.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      laptop.is_published ? "bg-emerald-400" : "bg-amber-400"
                    }`}
                  />
                  <p className="text-sm text-foreground truncate">{laptop.name}</p>
                </div>
                <a
                  href={`/admin/laptops/${laptop.id}`}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors shrink-0 ml-2"
                >
                  Edit →
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
