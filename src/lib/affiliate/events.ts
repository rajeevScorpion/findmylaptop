import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { GrowthAgentDatabaseClient } from "@/lib/growth-agents/types";
import type { AffiliatePlacement } from "./public";
import type { ResolvedAffiliateDestination } from "./resolver";

/**
 * Best-effort, privacy-minimized logging. Request headers, IP, cookies, users,
 * sessions, referrers, page URLs, and raw destination URLs are never accepted.
 */
export async function recordAffiliateClick(
  resolved: ResolvedAffiliateDestination,
  placement: AffiliatePlacement,
  client: GrowthAgentDatabaseClient = createAdminClient()
): Promise<void> {
  try {
    const { error } = await client.from("affiliate_click_events").insert({
      laptop_id: resolved.laptopId,
      offer_id: resolved.offerId,
      source_key: resolved.sourceKey,
      placement,
      destination_hash: resolved.destinationHash,
      destination_kind: resolved.destinationKind,
      monetized: resolved.monetized,
    });
    // Log only a database error code; never the resolved URL or request context.
    if (error) console.error("Affiliate click event insert failed", error.code);
  } catch {
    // Analytics transport failures must never block a safe outbound link. The
    // thrown object may contain request details, so it is intentionally omitted.
    console.error("Affiliate click event insert request failed");
  }
}
