import { cacheLife, cacheTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { COURSES_BY_CATEGORY } from "@/lib/constants";
import type { DomainId } from "@/lib/domains";

// DB-backed, admin-managed programme taxonomy. Source of truth is the `courses`
// table (domain -> category -> name), see migrations 018/019. Replaces the
// previously hardcoded COURSES_BY_CATEGORY in constants.ts. Read server-side
// only; pages pass the result down to client components as props.

export interface DomainTaxonomy {
  /** Programme categories in display order. */
  categories: string[];
  /** category -> ordered specialisation names. */
  coursesByCategory: Record<string, string[]>;
  /** Flat list of every specialisation name in the domain. */
  allCourses: string[];
}

function buildFromRows(
  rows: { category: string; name: string }[]
): DomainTaxonomy {
  const coursesByCategory: Record<string, string[]> = {};
  const categories: string[] = [];
  for (const { category, name } of rows) {
    if (!coursesByCategory[category]) {
      coursesByCategory[category] = [];
      categories.push(category);
    }
    coursesByCategory[category].push(name);
  }
  return {
    categories,
    coursesByCategory,
    allCourses: rows.map((r) => r.name),
  };
}

// Static fallback for Design only — keeps the live homepage working even if the
// taxonomy query fails or the courses table hasn't been migrated/seeded yet.
function designFallback(): DomainTaxonomy {
  const rows = Object.entries(COURSES_BY_CATEGORY).flatMap(([category, names]) =>
    names.map((name) => ({ category, name }))
  );
  return buildFromRows(rows);
}

export async function getTaxonomy(domain: DomainId): Promise<DomainTaxonomy> {
  "use cache";
  cacheTag("taxonomy");
  cacheLife("days");
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("courses")
      .select("category, name, sort_order")
      .eq("domain", domain)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("category", { ascending: true })
      .order("name", { ascending: true });

    if (error || !data || data.length === 0) {
      return domain === "design"
        ? designFallback()
        : { categories: [], coursesByCategory: {}, allCourses: [] };
    }

    return buildFromRows(data as { category: string; name: string }[]);
  } catch {
    return domain === "design"
      ? designFallback()
      : { categories: [], coursesByCategory: {}, allCourses: [] };
  }
}

// Fetch taxonomy for every domain at once — used by the admin laptop form so a
// laptop can be re-tagged when its domain changes. Returns a map keyed by
// DomainId. Falls back per-domain like getTaxonomy.
export async function getAllTaxonomies(): Promise<Record<DomainId, DomainTaxonomy>> {
  "use cache";
  cacheTag("taxonomy");
  cacheLife("days");
  const [design, technology, management] = await Promise.all([
    getTaxonomy("design"),
    getTaxonomy("technology"),
    getTaxonomy("management"),
  ]);
  return { design, technology, management };
}
