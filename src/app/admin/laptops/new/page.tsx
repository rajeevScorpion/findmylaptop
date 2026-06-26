import { AddLaptopWorkspace } from "@/components/admin/AddLaptopWorkspace";
import { ChevronLeft } from "lucide-react";
import { getAllTaxonomies } from "@/lib/taxonomy";

export default async function AdminNewLaptopPage() {
  const taxonomies = await getAllTaxonomies();
  return (
    <div className="space-y-5">
      <div>
        <a
          href="/admin/laptops"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ChevronLeft className="w-3 h-3" />
          Back to laptops
        </a>
        <h1 className="text-xl font-bold text-foreground">Add Laptop</h1>
        <p className="text-sm text-muted-foreground">
          Paste Amazon details and use AI to extract specs, or fill in manually.
        </p>
      </div>
      <AddLaptopWorkspace taxonomies={taxonomies} />
    </div>
  );
}
