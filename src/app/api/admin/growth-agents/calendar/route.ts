import { connection } from "next/server";
import {
  adminAuthorizationErrorResponse,
  requireAdmin,
} from "@/lib/admin/authorization";
import { researchCalendarUpdateSchema } from "@/lib/research-calendar/schemas";
import {
  DEFAULT_CALENDAR_ID,
  getResearchCalendarDashboard,
  updateResearchCalendar,
} from "@/lib/research-calendar/service";

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
  console.error("Research calendar route failed");
  return json({ error: "The research calendar request failed." }, 500);
}

export async function GET(): Promise<Response> {
  await connection();
  try {
    await requireAdmin();
    return json({ dashboard: await getResearchCalendarDashboard() });
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request): Promise<Response> {
  try {
    const admin = await requireAdmin();
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON body." }, 400);
    }

    const parsed = researchCalendarUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return json(
        {
          error: "Invalid research calendar update.",
          details: parsed.error.flatten(),
        },
        400
      );
    }

    return json({
      dashboard: await updateResearchCalendar(
        DEFAULT_CALENDAR_ID,
        parsed.data,
        admin.email
      ),
    });
  } catch (error) {
    return routeError(error);
  }
}
