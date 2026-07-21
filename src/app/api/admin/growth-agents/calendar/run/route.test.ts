import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  adminAuthorizationErrorResponse,
  requireAdmin,
} from "@/lib/admin/authorization";
import { runResearchCalendarDayById } from "@/lib/research-calendar/orchestrator";
import { getResearchCalendarDashboard } from "@/lib/research-calendar/service";
import { POST } from "./route";

vi.mock("@/lib/admin/authorization", () => ({
  adminAuthorizationErrorResponse: vi.fn().mockReturnValue(null),
  requireAdmin: vi.fn(),
}));
vi.mock("@/lib/research-calendar/orchestrator", () => ({
  runResearchCalendarDayById: vi.fn(),
}));
vi.mock("@/lib/research-calendar/service", () => ({
  getResearchCalendarDashboard: vi.fn(),
}));

const DAY_ID = "11111111-1111-4111-8111-111111111111";
const dashboard = {
  calendar: null,
  days: [],
  recentRuns: [],
  recentPackets: [],
};

function request(): Request {
  return new Request("https://laptopfinder.test/api/admin/growth-agents/calendar/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ calendarDayId: DAY_ID, createBlogDrafts: true }),
  });
}

beforeEach(() => {
  vi.mocked(requireAdmin).mockResolvedValue({
    id: "22222222-2222-4222-8222-222222222222",
    email: "admin@example.com",
  });
  vi.mocked(adminAuthorizationErrorResponse).mockReturnValue(null);
  vi.mocked(getResearchCalendarDashboard).mockResolvedValue(dashboard);
});

describe("POST /api/admin/growth-agents/calendar/run", () => {
  it("returns the exact failed-run message while preserving refreshed dashboard data", async () => {
    const outcome = {
      dayId: DAY_ID,
      jobId: "33333333-3333-4333-8333-333333333333",
      scheduleRunId: "44444444-4444-4444-8444-444444444444",
      status: "failed" as const,
      packetsProduced: 0,
      draftsProduced: 0,
      message: "Invalid schema for response_format 'laptopfinder_research_packets'.",
    };
    vi.mocked(runResearchCalendarDayById).mockResolvedValue(outcome);

    const response = await POST(request());
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toBe("Cookie");
    expect(payload).toEqual({
      error: outcome.message,
      result: outcome,
      dashboard,
    });
  });

  it("does not add an error field to successful outcomes", async () => {
    const outcome = {
      dayId: DAY_ID,
      jobId: "33333333-3333-4333-8333-333333333333",
      scheduleRunId: "44444444-4444-4444-8444-444444444444",
      status: "succeeded" as const,
      packetsProduced: 2,
      draftsProduced: 1,
      message: "Research completed.",
    };
    vi.mocked(runResearchCalendarDayById).mockResolvedValue(outcome);

    const response = await POST(request());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ result: outcome, dashboard });
    expect(payload).not.toHaveProperty("error");
  });

  it("returns a typed deterministic no-topic outcome as HTTP 200", async () => {
    const outcome = {
      dayId: DAY_ID,
      jobId: "33333333-3333-4333-8333-333333333333",
      scheduleRunId: "44444444-4444-4444-8444-444444444444",
      status: "no_good_topic" as const,
      packetsProduced: 0,
      draftsProduced: 0,
      message: "The proposed topic was already covered recently.",
      reasonCode: "duplicate_topic" as const,
      selectionSummary: {
        primaryReason: "duplicate_topic" as const,
        message: "The proposed topic was already covered recently.",
        candidatesEvaluated: 1,
        candidatesAccepted: 0,
        rejectionCounts: { duplicate_topic: 1 },
        historyWindowDays: 180,
        similarityThreshold: 62,
        closestDuplicate: null,
      },
    };
    vi.mocked(runResearchCalendarDayById).mockResolvedValue(outcome);

    const response = await POST(request());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ result: outcome, dashboard });
    expect(payload).not.toHaveProperty("error");
  });
});
