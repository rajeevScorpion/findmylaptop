import { createClient } from "@/lib/supabase/server";
import { RefreshPricesPanel } from "@/components/admin/RefreshPricesPanel";

export default async function RefreshPricesPage() {
  const supabase = await createClient();

  const { data: laptops } = await supabase
    .from("laptops")
    .select("id, name, brand, price_label, availability, last_checked, is_published, amazon_affiliate_url, created_at")
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-bold text-foreground">Refresh Prices</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Fetches the latest price and availability for all published laptops from Amazon.
        </p>
      </div>

      <RefreshPricesPanel laptops={laptops ?? []} />
    </div>
  );
}
