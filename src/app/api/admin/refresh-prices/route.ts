import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  resolveAsin,
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

  // Optional: scope the refresh to a specific set of laptop ids (a single row
  // or one page). Falls back to all published laptops (cron / "refresh all").
  let ids: string[] | null = null;
  // When true, any currently-unpublished laptop that comes back available is
  // automatically re-published (used by the "Refresh all unpublished" action).
  let republishIfAvailable = false;
  try {
    const body = await request.json();
    if (Array.isArray(body?.ids) && body.ids.length > 0) {
      ids = body.ids.filter((id: unknown): id is string => typeof id === "string");
    }
    republishIfAvailable = body?.republishIfAvailable === true;
  } catch {
    // No / invalid body → refresh everything.
  }

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

  const results = {
    total: laptops.length,
    updated: 0,
    failed: 0,
    errors: [] as string[],
    rows: [] as UpdatedRow[],
  };

  for (const laptop of laptops) {
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

      await supabase
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
