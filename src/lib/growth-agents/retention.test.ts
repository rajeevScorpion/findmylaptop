import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/chip-learning/service", () => ({
  deleteExpiredChipLearningData: vi.fn(),
}));
vi.mock("./settings", () => ({
  listAgentSettingRows: vi.fn(),
  resolveAgentSettings: vi.fn(),
}));

import { createAdminClient } from "@/lib/supabase/admin";
import { listAgentSettingRows, resolveAgentSettings } from "./settings";
import {
  drainRetentionBatches,
  runGrowthAgentRetentionCleanup,
} from "./retention";

describe("bounded retention draining", () => {
  it("continues full selections and totals only affected rows", async () => {
    const operation = vi
      .fn()
      .mockResolvedValueOnce({ selected: 500, affected: 490 })
      .mockResolvedValueOnce({ selected: 500, affected: 500 })
      .mockResolvedValueOnce({ selected: 12, affected: 12 });

    await expect(drainRetentionBatches(operation)).resolves.toEqual({
      affected: 1_002,
      capacityReached: false,
    });
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("reports when the bounded run may have more rows", async () => {
    const operation = vi
      .fn()
      .mockResolvedValue({ selected: 10, affected: 10 });

    await expect(
      drainRetentionBatches(operation, { batchSize: 10, maxBatches: 2 })
    ).resolves.toEqual({ affected: 20, capacityReached: true });
    expect(operation).toHaveBeenCalledTimes(2);
  });
});

describe("growth-agent retention", () => {
  beforeEach(() => {
    vi.mocked(createAdminClient).mockReset();
    vi.mocked(listAgentSettingRows).mockReset();
    vi.mocked(resolveAgentSettings).mockReset();
  });

  it("skips every destructive operation when configured retention cannot be read", async () => {
    vi.mocked(listAgentSettingRows).mockRejectedValueOnce(
      new Error("temporary settings read failure")
    );

    const result = await runGrowthAgentRetentionCleanup(
      new Date("2026-07-16T00:00:00.000Z")
    );

    expect(result.errors).toEqual(["settings_read_failed"]);
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(resolveAgentSettings).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      deletedAgentJobs: 0,
      deletedAuditEvents: 0,
      deletedAffiliateClicks: 0,
      deletedChipEvents: 0,
      deletedChipProfiles: 0,
      deletedChatSessions: 0,
      scrubbedCandidatePayloads: 0,
      scrubbedOfferPayloads: 0,
    });
  });

  it("skips cleanup when any explicit retention row is missing", async () => {
    vi.mocked(listAgentSettingRows).mockResolvedValueOnce([]);

    const result = await runGrowthAgentRetentionCleanup(
      new Date("2026-07-16T00:00:00.000Z")
    );

    expect(result.errors).toEqual(["settings_read_failed"]);
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(resolveAgentSettings).not.toHaveBeenCalled();
  });
});
