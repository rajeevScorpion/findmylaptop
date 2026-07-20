import { NextRequest, NextResponse } from "next/server";
import {
  adminAuthorizationErrorResponse,
  requireAdmin,
} from "@/lib/admin/authorization";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveAsin } from "@/lib/amazon-creators";

// One-time (re-runnable) backfill: resolves the stored amazon_affiliate_url of
// every laptop missing an `asin` (mostly amzn.to short links) and stores the
// resolved ASIN, so duplicate detection can do exact, indexed lookups.
// POST with no body. Returns a per-row summary. Safe to run repeatedly — it
// only touches rows where asin IS NULL.

export async function POST(_request: NextRequest) {
  try {
    await requireAdmin();
  } catch (error) {
    return (
      adminAuthorizationErrorResponse(error) ??
      NextResponse.json({ error: "Could not authorize request" }, { status: 500 })
    );
  }
  const supabase = createAdminClient();

  // Fetch all rows and filter in code — avoids any quirk with filtering on a
  // freshly-added column before PostgREST's schema cache catches up.
  const { data: allRows, error } = await supabase
    .from("laptops")
    .select("id, name, amazon_affiliate_url, asin");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (allRows ?? []).filter((r) => !r.asin);

  const results: { name: string; asin: string | null; status: string }[] = [];
  let updated = 0;

  // Sequential — resolving short links makes one redirect request each; keeping
  // it serial avoids hammering Amazon and keeps the run easy to reason about.
  for (const row of rows) {
    const asin = await resolveAsin(row.amazon_affiliate_url ?? "");
    if (!asin) {
      results.push({ name: row.name, asin: null, status: "could not resolve" });
      continue;
    }
    const { error: updErr } = await supabase
      .from("laptops")
      .update({ asin })
      .eq("id", row.id);
    if (updErr) {
      results.push({ name: row.name, asin, status: `update failed: ${updErr.message}` });
    } else {
      updated++;
      results.push({ name: row.name, asin, status: "ok" });
    }
  }

  return NextResponse.json({
    totalLaptops: allRows?.length ?? 0,
    missingAsin: rows.length,
    updated,
    results,
  });
}
