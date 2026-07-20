import { verifyCronRequest } from "@/lib/admin/cron-auth";
import { runGrowthAgentRetentionCleanup } from "@/lib/growth-agents/retention";
import { pollResearchCalendar } from "@/lib/research-calendar/orchestrator";

export const maxDuration = 300;

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };

export async function GET(request: Request): Promise<Response> {
  if (!verifyCronRequest(request)) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  try {
    const [research, retention] = await Promise.all([
      pollResearchCalendar(),
      runGrowthAgentRetentionCleanup(),
    ]);
    return Response.json({ research, retention }, { headers: NO_STORE_HEADERS });
  } catch {
    console.error("Growth-agent cron poll failed");
    return Response.json(
      { error: "Growth-agent scheduler failed." },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
