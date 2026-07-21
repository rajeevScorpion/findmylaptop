import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  adminAuthorizationErrorResponse,
  requireAdmin,
} from "@/lib/admin/authorization";
import { getEffectiveSourceHealth } from "@/lib/sources/health";
import { GET, POST } from "./route";

vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/lib/admin/authorization", () => ({
  adminAuthorizationErrorResponse: vi.fn().mockReturnValue(null),
  requireAdmin: vi.fn(),
}));
vi.mock("@/lib/sources/health", () => ({
  getEffectiveSourceHealth: vi.fn(),
}));

const sources = [{ sourceKey: "amazon", credentialStatus: "valid" }];

beforeEach(() => {
  vi.mocked(requireAdmin).mockResolvedValue({
    id: "admin-id",
    email: "admin@example.com",
  });
  vi.mocked(adminAuthorizationErrorResponse).mockReturnValue(null);
  vi.mocked(getEffectiveSourceHealth).mockResolvedValue(sources as never);
});

describe("admin source health route", () => {
  it("keeps GET health reads side-effect free even with a legacy probe query", async () => {
    const response = await GET(
      new Request(
        "https://laptopfinder.test/api/admin/growth-agents/sources/health?probe=true"
      )
    );

    expect(response.status).toBe(200);
    expect(getEffectiveSourceHealth).toHaveBeenCalledWith();
    await expect(response.json()).resolves.toEqual({ sources, probed: false });
  });

  it("uses POST for an authenticated remote probe that persists health", async () => {
    const response = await POST();

    expect(getEffectiveSourceHealth).toHaveBeenCalledWith({
      probe: true,
      actorEmail: "admin@example.com",
    });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({ sources, probed: true });
  });
});
