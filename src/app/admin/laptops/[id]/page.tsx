import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LaptopForm } from "@/components/admin/LaptopForm";
import { ChevronLeft } from "lucide-react";
import { getAllTaxonomies } from "@/lib/taxonomy";
import type { Laptop } from "@/lib/types";

export default async function AdminEditLaptopPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: laptop } = await supabase
    .from("laptops")
    .select("*")
    .eq("id", id)
    .single();

  if (!laptop) {
    notFound();
  }

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
        <h1 className="text-xl font-bold text-foreground">Edit Laptop</h1>
        <p className="text-sm text-muted-foreground">
          Update specs, publish status, or affiliate link for{" "}
          <span className="text-foreground font-medium">{laptop.name}</span>.
        </p>
      </div>
      <LaptopForm laptop={laptop as Laptop} taxonomies={taxonomies} />
    </div>
  );
}
