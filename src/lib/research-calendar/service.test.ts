import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

import {
  listRecentResearchSourceUses,
  listResearchTopicHistory,
} from "./service";

type QueryResult = { data: unknown[] | null; error: unknown | null };

function queryBuilder(result: QueryResult) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
    gte: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    then: (
      resolve: (value: QueryResult) => unknown,
      reject: (reason: unknown) => unknown
    ) => Promise.resolve(result).then(resolve, reject),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.neq.mockReturnValue(builder);
  builder.gte.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  return builder;
}

function adminClientFor(...builders: ReturnType<typeof queryBuilder>[]) {
  const from = vi.fn();
  for (const builder of builders) from.mockReturnValueOnce(builder);
  mocks.createAdminClient.mockReturnValue({ from });
  return { from };
}

function packetRow(input: {
  id: string;
  createdAt: string;
  status?: string;
  scheduleRunId?: string;
  sources?: Array<{ url: string; title?: string }>;
}) {
  return {
    id: input.id,
    schedule_run_id: input.scheduleRunId ?? "run-1",
    calendar_day_id: "day-1",
    topic_title: `Topic ${input.id}`,
    topic_angle: `Angle ${input.id}`,
    summary: `Summary ${input.id}`,
    content_type: "hardware-trend",
    target_audience: ["students"],
    source_refs_json: input.sources ?? [],
    status: input.status ?? "used",
    confidence_score: 90,
    created_at: input.createdAt,
  };
}

describe("research novelty history service", () => {
  const now = new Date("2026-07-21T09:00:00.000Z");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads packet, recent rejected, and non-archived post history with stable ordering", async () => {
    const regular = queryBuilder({
      data: [
        packetRow({
          id: "packet-b",
          createdAt: "2026-07-20T09:00:00.000Z",
          sources: [
            { url: "https://example.com/b" },
            { url: "https://example.com/b" },
          ],
        }),
      ],
      error: null,
    });
    const rejected = queryBuilder({
      data: [
        packetRow({
          id: "packet-a",
          createdAt: "2026-07-20T09:00:00.000Z",
          status: "rejected",
        }),
      ],
      error: null,
    });
    const posts = queryBuilder({
      data: [
        {
          id: "post-1",
          title: "Manual CMS topic",
          excerpt: null,
          template_type: "buying-guide",
          audience: ["buyers"],
          primary_keyword: "manual topic",
          secondary_keywords: ["cms"],
          status: "draft",
          created_at: "2026-07-21T08:00:00.000Z",
        },
      ],
      error: null,
    });
    const client = adminClientFor(regular, rejected, posts);

    const history = await listResearchTopicHistory({
      now,
      windowDays: 180,
      limit: 50,
    });

    expect(client.from.mock.calls.map(([table]) => table)).toEqual([
      "research_packets",
      "research_packets",
      "blog_posts",
    ]);
    expect(regular.neq).toHaveBeenCalledWith("status", "rejected");
    expect(rejected.eq).toHaveBeenCalledWith("status", "rejected");
    expect(rejected.gte).toHaveBeenCalledWith(
      "created_at",
      "2026-06-21T09:00:00.000Z"
    );
    expect(posts.neq).toHaveBeenCalledWith("status", "archived");
    expect(regular.order.mock.calls).toEqual([
      ["created_at", { ascending: false }],
      ["id", { ascending: true }],
    ]);
    expect(history.map((item) => `${item.kind}:${item.id}`)).toEqual([
      "blog_post:post-1",
      "research_packet:packet-a",
      "research_packet:packet-b",
    ]);
    expect(history[2].sourceUrls).toEqual(["https://example.com/b"]);
    expect(history[0].summary).toBe("manual topic, cms");
  });

  it("fails closed when the combined eligible history exceeds the safe ceiling", async () => {
    const rows = Array.from({ length: 50 }, (_, index) => ({ id: `p-${index}` }));
    adminClientFor(
      queryBuilder({ data: rows, error: null }),
      queryBuilder({ data: [], error: null }),
      queryBuilder({ data: [{ id: "post-over-limit" }], error: null })
    );

    await expect(
      listResearchTopicHistory({ now, windowDays: 180, limit: 50 })
    ).rejects.toMatchObject({
      code: "research_novelty_history_limit_exceeded",
    });
  });

  it("treats any history query failure as fatal", async () => {
    adminClientFor(
      queryBuilder({ data: null, error: { message: "packet query failed" } }),
      queryBuilder({ data: [], error: null }),
      queryBuilder({ data: [], error: null })
    );

    await expect(
      listResearchTopicHistory({ now, windowDays: 180 })
    ).rejects.toMatchObject({ code: "database_error" });
  });
});

describe("research source-use service", () => {
  const now = new Date("2026-07-21T09:00:00.000Z");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("aggregates source URLs by run before selecting the newest non-empty runs", async () => {
    const query = queryBuilder({
      data: [
        {
          id: "packet-1",
          schedule_run_id: "run-new",
          source_refs_json: [{ url: "https://adobe.com/a" }],
          created_at: "2026-07-20T10:00:00.000Z",
        },
        {
          id: "packet-2",
          schedule_run_id: "run-new",
          source_refs_json: [
            { url: "https://autodesk.com/b" },
            { url: "https://adobe.com/a" },
          ],
          created_at: "2026-07-20T10:00:01.000Z",
        },
        {
          id: "packet-3",
          schedule_run_id: "run-old",
          source_refs_json: [{ url: "https://blender.org/requirements" }],
          created_at: "2026-07-19T10:00:00.000Z",
        },
        {
          id: "packet-4",
          schedule_run_id: "run-empty",
          source_refs_json: [],
          created_at: "2026-07-20T11:00:00.000Z",
        },
      ],
      error: null,
    });
    adminClientFor(query);

    const uses = await listRecentResearchSourceUses({
      calendarDayId: "day-1",
      currentScheduleRunId: "run-current",
      now,
      cooldownDays: 14,
      runLimit: 2,
    });

    expect(query.eq).toHaveBeenCalledWith("calendar_day_id", "day-1");
    expect(query.neq).toHaveBeenCalledWith(
      "schedule_run_id",
      "run-current"
    );
    expect(uses).toEqual([
      {
        runId: "run-new",
        usedAt: "2026-07-20T10:00:01.000Z",
        sourceUrls: ["https://adobe.com/a", "https://autodesk.com/b"],
      },
      {
        runId: "run-old",
        usedAt: "2026-07-19T10:00:00.000Z",
        sourceUrls: ["https://blender.org/requirements"],
      },
    ]);
  });

  it("does not query when source rotation has no active window", async () => {
    const result = await listRecentResearchSourceUses({
      calendarDayId: "day-1",
      currentScheduleRunId: "run-current",
      now,
      cooldownDays: 14,
      runLimit: 0,
    });

    expect(result).toEqual([]);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });
});
