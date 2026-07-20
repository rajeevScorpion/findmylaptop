import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import {
  adminAuthorizationErrorResponse,
  requireAdmin,
} from "@/lib/admin/authorization";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  MAX_REFRESH_PRICES_REQUEST_BYTES,
  refreshPricesRequestSchema,
} from "@/lib/admin/catalog-write-schema";
import {
  resolveAsin,
  fetchProductByAsin,
  parsePriceToInt,
  AmazonApiError,
} from "@/lib/amazon-creators";

function isCronRequest(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("Authorization") === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  if (!isCronRequest(request)) {
    try {
      await requireAdmin();
    } catch (error) {
      return (
        adminAuthorizationErrorResponse(error) ??
        NextResponse.json({ error: "Could not authorize request" }, { status: 500 })
      );
    }
  }

  // An empty body refreshes all published laptops. A JSON body may scope the
  // run to bounded UUIDs and opt into republishing items that are available.
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return NextResponse.json({ error: "Could not read request body" }, { status: 400 });
  }

  if (new TextEncoder().encode(raw).byteLength > MAX_REFRESH_PRICES_REQUEST_BYTES) {
    return NextResponse.json({ error: "Request body is too large" }, { status: 413 });
  }
  if (
    raw.trim() &&
    !request.headers.get("content-type")?.toLowerCase().includes("application/json")
  ) {
    return NextResponse.json(
      { error: "Content-Type must be application/json" },
      { status: 415 }
    );
  }

  let json: unknown = {};
  if (raw.trim()) {
    try {
      json = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
  }
  const parsed = refreshPricesRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid refresh request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const ids = parsed.data.ids ?? null;
  const republishIfAvailable = parsed.data.republishIfAvailable;
  const supabase = createAdminClient();

  // When specific IDs are requested (e.g. re-checking attention/unpublished
  // laptops), skip the is_published filter so they can be fetched too.
  let query = supabase
    .from("laptops")
    .select("id, name, amazon_affiliate_url, is_published")
    .not("amazon_affiliate_url", "is", null);

  if (ids) {
    query = query.in("id", ids);
  } else {
    query = query.eq("is_published", true);
  }

  const { data: laptops, error } = await query;

  if (error) {
    return NextResponse.json({ error: "Failed to fetch laptops" }, { status: 500 });
  }

  function isUnavailable(availability: string | null | undefined): boolean {
    if (!availability) return false;
    const l = availability.toLowerCase();
    return l.includes("unavailable") || l.includes("out of stock") || l.includes("not available");
  }

  type UpdatedRow = {
    id: string;
    price_label: string | null;
    availability: string | null;
    last_checked: string;
    auto_unpublished?: boolean;
    auto_republished?: boolean;
  };

  const laptopRows = laptops ?? [];
  const results = {
    total: laptopRows.length,
    updated: 0,
    failed: 0,
    errors: [] as string[],
    rows: [] as UpdatedRow[],
  };

  for (const laptop of laptopRows) {
    const asin = await resolveAsin(laptop.amazon_affiliate_url);
    if (!asin) {
      results.failed++;
      results.errors.push(`${laptop.name}: could not extract ASIN`);
      continue;
    }

    try {
      const product = await fetchProductByAsin(asin);

      const unavailable = isUnavailable(product.availability);
      // Only auto-unpublish if the laptop was published before this check.
      // Re-checking an already-unpublished laptop should never flip it back.
      const shouldUnpublish = unavailable && laptop.is_published;
      // Re-publish an unpublished laptop that is back in stock — only when the
      // caller opts in (the "Refresh all unpublished" action).
      const shouldRepublish = republishIfAvailable && !unavailable && !laptop.is_published;
      const update: UpdatedRow = {
        id: laptop.id,
        price_label: product.price ?? null,
        availability: product.availability ?? null,
        last_checked: new Date().toISOString().split("T")[0],
        ...(shouldUnpublish && { auto_unpublished: true }),
        ...(shouldRepublish && { auto_republished: true }),
      };

      const { error: updateError } = await supabase
        .from("laptops")
        .update({
          price_label: update.price_label,
          price_approx: parsePriceToInt(product.price),
          availability: update.availability,
          last_checked: update.last_checked,
          ...(shouldUnpublish && { is_published: false }),
          ...(shouldRepublish && { is_published: true }),
        })
        .eq("id", laptop.id);
      if (updateError) throw new Error("Database update failed");

      results.rows.push(update);
      results.updated++;
    } catch (err) {
      results.failed++;
      const msg = err instanceof AmazonApiError ? err.message : String(err);
      results.errors.push(`${laptop.name}: ${msg}`);
    }

    // Respect Amazon's ~1 req/sec rate limit
    await new Promise((resolve) => setTimeout(resolve, 1100));
  }

  revalidateTag("laptops", { expire: 0 });
  return NextResponse.json(results);
}
