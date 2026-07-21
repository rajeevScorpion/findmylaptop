import { describe, expect, it, vi } from "vitest";

import { reviewCandidate } from "./candidates";

const CANDIDATE_ID = "11111111-1111-4111-8111-111111111111";

function pendingCandidate() {
  const timestamp = "2026-07-21T10:00:00.000Z";
  return {
    id: CANDIDATE_ID,
    discovery_job_id: null,
    source_key: "amazon",
    source_product_id: "B0EXAMPLE1",
    dedupe_key: "amazon:B0EXAMPLE1",
    raw_payload_json: {},
    normalized_json: {
      sourceKey: "amazon",
      sourceProductId: "B0EXAMPLE1",
      title: "Example laptop",
      priceFreshness: "not_provided",
      url: "https://www.amazon.in/dp/B0EXAMPLE1",
      fetchedAt: timestamp,
      fitTags: [],
      riskTags: [],
      confidenceScore: 80,
      fitScore: 70,
      complianceStatus: "safe",
    },
    title: "Example laptop",
    brand: "Example",
    model: "Model 1",
    price_amount: null,
    price_currency: null,
    price_fetched_at: null,
    product_url: "https://www.amazon.in/dp/B0EXAMPLE1",
    affiliate_url: null,
    image_url: null,
    source_fetched_at: timestamp,
    fresh_until: null,
    confidence_score: 80,
    fit_score: 70,
    fit_tags: [],
    risk_tags: [],
    compliance_status: "safe",
    review_status: "pending",
    admin_notes: null,
    error_message: null,
    reviewed_by: null,
    reviewed_at: null,
    promoted_laptop_id: null,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

function reviewClient() {
  const candidate = pendingCandidate();
  const updates: Record<string, unknown>[] = [];
  const auditEvents: Record<string, unknown>[] = [];

  const client = {
    from: vi.fn((table: string) => {
      if (table === "audit_events") {
        return {
          insert: async (event: Record<string, unknown>) => {
            auditEvents.push(event);
            return { error: null };
          },
        };
      }

      if (table !== "product_candidates") {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: candidate, error: null }),
          }),
        }),
        update: (values: Record<string, unknown>) => {
          updates.push(values);
          return {
            eq: () => ({
              neq: () => ({
                select: () => ({
                  maybeSingle: async () => ({
                    data: { ...candidate, ...values },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        },
      };
    }),
  };

  return { client, updates, auditEvents };
}

describe("product candidate review decisions", () => {
  it.each([
    ["reject", "rejected"],
    ["needs_edit", "needs_edit"],
    ["stale", "stale"],
  ] as const)("stores the %s action as the %s review status", async (action, status) => {
    const { client, updates, auditEvents } = reviewClient();

    const reviewed = await reviewCandidate(
      CANDIDATE_ID,
      { action },
      "admin@example.com",
      { client: client as never }
    );

    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      review_status: status,
      reviewed_by: "admin@example.com",
    });
    expect(reviewed.review_status).toBe(status);
    expect(auditEvents[0]).toMatchObject({
      event_type: `product_candidate.${status}`,
      metadata_json: { review_status: status },
    });
  });
});
