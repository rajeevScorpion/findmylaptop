import {
  adminAuthorizationErrorResponse,
  requireAdmin,
} from "@/lib/admin/authorization";
import { runResearchCalendarDayById } from "@/lib/research-calendar/orchestrator";
import { researchRunRequestSchema } from "@/lib/research-calendar/schemas";
import { getResearchCalendarDashboard } from "@/lib/research-calendar/service";

export const maxDuration = 300;

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: PRIVATE_HEADERS });
}

function routeError(error: unknown): Response {
  const authorizationResponse = adminAuthorizationErrorResponse(error);
  if (authorizationResponse) return authorizationResponse;
  console.error("Manual research calendar run failed");
  return json({ error: "The research run could not be started." }, 500);
}

export async function POST(request: Request): Promise<Response> {
  try {
    const admin = await requireAdmin();
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON body." }, 400);
    }

    const parsed = researchRunRequestSchema.safeParse(body);
    if (!parsed.success || !parsed.data.calendarDayId) {
      return json(
        {
          error: "A valid calendarDayId is required.",
          details: parsed.success ? undefined : parsed.error.flatten(),
        },
        400
      );
    }

    const outcome = await runResearchCalendarDayById({
      calendarDayId: parsed.data.calendarDayId,
      requestedBy: admin.email,
      createBlogDrafts: parsed.data.createBlogDrafts,
    });
    return json(
      {
        result: outcome,
        dashboard: await getResearchCalendarDashboard(),
      },
      outcome.status === "failed" ? 502 : 200
    );
  } catch (error) {
    return routeError(error);
  }
}
