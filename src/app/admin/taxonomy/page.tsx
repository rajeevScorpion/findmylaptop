import { createClient } from "@/lib/supabase/server";
import { TaxonomyManager, type CourseRow } from "@/components/admin/taxonomy/TaxonomyManager";
import { AdminGuideLink } from "@/components/admin/guide/AdminGuideLink";

export default async function AdminTaxonomyPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("courses")
    .select("id, domain, category, name, sort_order, is_active")
    .order("sort_order", { ascending: true });

  const rows = (data ?? []) as CourseRow[];

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Taxonomy</h1>
          <p className="text-sm text-muted-foreground">
            Manage the programmes and specialisations shown in the finder and laptop
            form, per domain. Hiding (toggle) keeps existing laptop tags intact;
            deleting removes the programme permanently.
          </p>
        </div>
        <AdminGuideLink section="taxonomy" />
      </div>
      <TaxonomyManager initial={rows} />
    </div>
  );
}
