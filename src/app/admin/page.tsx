import { createClient } from "@/lib/supabase/server";
import { Laptop, CheckCircle2, FileText, Plus } from "lucide-react";

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const { data: laptops } = await supabase
    .from("laptops")
    .select("id, is_published, updated_at, name")
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

  const STATS = [
    { label: "Total Laptops", value: total, icon: <Laptop className="w-5 h-5 text-primary" /> },
    { label: "Published", value: published, icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" /> },
    { label: "Drafts", value: drafts, icon: <FileText className="w-5 h-5 text-amber-400" /> },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
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

      {/* Recent laptops */}
      {laptops && laptops.length > 0 && (
        <div className="glass-card rounded-xl border overflow-hidden">
          <div className="px-4 py-3 border-b border-border/30">
            <p className="text-sm font-medium text-foreground">Recent laptops</p>
          </div>
          <div className="divide-y divide-border/20">
            {laptops.slice(0, 8).map((laptop) => (
              <div key={laptop.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      laptop.is_published ? "bg-emerald-400" : "bg-amber-400"
                    }`}
                  />
                  <p className="text-sm text-foreground">{laptop.name}</p>
                </div>
                <a
                  href={`/admin/laptops/${laptop.id}`}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  Edit →
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
