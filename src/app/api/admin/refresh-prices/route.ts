import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  extractAsin,
  fetchProductByAsin,
  parsePriceToInt,
  AmazonApiError,
} from "@/lib/amazon-creators";

function isAdminEmail(email: string): boolean {
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes(email.toLowerCase());
}

function isCronRequest(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("Authorization") === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  if (!isCronRequest(request)) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAdminEmail(user.email ?? ""))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: laptops, error } = await supabase
    .from("laptops")
    .select("id, name, amazon_affiliate_url")
    .eq("is_published", true)
    .not("amazon_affiliate_url", "is", null);

  if (error) {
    return NextResponse.json({ error: "Failed to fetch laptops" }, { status: 500 });
  }

  const results = {
    total: laptops.length,
    updated: 0,
    failed: 0,
    errors: [] as string[],
  };

  for (const laptop of laptops) {
    const asin = extractAsin(laptop.amazon_affiliate_url);
    if (!asin) {
      results.failed++;
      results.errors.push(`${laptop.name}: could not extract ASIN`);
      continue;
    }

    try {
      const product = await fetchProductByAsin(asin);

      await supabase
        .from("laptops")
        .update({
          price_label: product.price ?? null,
          price_approx: parsePriceToInt(product.price),
          availability: product.availability ?? null,
          last_checked: new Date().toISOString().split("T")[0],
        })
        .eq("id", laptop.id);

      results.updated++;
    } catch (err) {
      results.failed++;
      const msg = err instanceof AmazonApiError ? err.message : String(err);
      results.errors.push(`${laptop.name}: ${msg}`);
    }

    // Respect Amazon's ~1 req/sec rate limit
    await new Promise((resolve) => setTimeout(resolve, 1100));
  }

  return NextResponse.json(results);
}
