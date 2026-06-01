import { createClient } from "@/lib/supabase/server";
import { Plus, Pencil } from "lucide-react";
import { PublishToggle } from "@/components/admin/PublishToggle";
import { DeleteLaptopButton } from "@/components/admin/DeleteLaptopButton";

export default async function AdminLaptopsPage() {
  const supabase = await createClient();

  const { data: laptops } = await supabase
    .from("laptops")
    .select("id, name, brand, price_label, tier, is_published, updated_at")
    .order("updated_at", { ascending: false });

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Laptops</h1>
        <a
          href="/admin/laptops/new"
          className="inline-flex items-center gap-1.5 rounded-[min(var(--radius-md),12px)] h-7 px-2.5 text-[0.8rem] font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          Add Laptop
        </a>
      </div>

      {laptops && laptops.length > 0 ? (
        <div className="glass-card rounded-xl border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/30 text-xs text-muted-foreground">
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Price</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Updated</th>
                <th className="text-center px-4 py-3 font-medium">Published</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {laptops.map((laptop) => (
                <tr key={laptop.id} className="hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{laptop.name}</p>
                      {laptop.brand && (
                        <p className="text-xs text-muted-foreground">{laptop.brand}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="text-sm text-foreground">{laptop.price_label ?? "—"}</span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-xs text-muted-foreground">
                      {new Date(laptop.updated_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <PublishToggle
                      laptopId={laptop.id}
                      initialPublished={laptop.is_published}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <a
                        href={`/admin/laptops/${laptop.id}`}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground h-7 px-2 rounded-md hover:bg-muted/40 transition-colors"
                      >
                        <Pencil className="w-3 h-3" />
                        Edit
                      </a>
                      <DeleteLaptopButton laptopId={laptop.id} laptopName={laptop.name} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="glass-card rounded-xl border p-10 text-center space-y-3">
          <p className="text-sm font-medium text-foreground">No laptops yet</p>
          <p className="text-xs text-muted-foreground">
            Add your first laptop recommendation to get started.
          </p>
          <a
            href="/admin/laptops/new"
            className="inline-flex items-center gap-1.5 rounded-[min(var(--radius-md),12px)] h-7 px-2.5 text-[0.8rem] font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            Add Laptop
          </a>
        </div>
      )}
    </div>
  );
}
