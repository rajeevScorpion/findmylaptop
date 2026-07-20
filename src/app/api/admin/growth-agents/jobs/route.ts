import { z } from "zod";
import { connection } from "next/server";
import {
  adminAuthorizationErrorResponse,
  requireAdmin,
} from "@/lib/admin/authorization";
import {
  getAgentErrorHttpStatus,
  isAgentError,
} from "@/lib/growth-agents/errors";
import { listAgentJobs } from "@/lib/growth-agents/jobs";
import { AGENT_JOB_STATUSES } from "@/lib/growth-agents/types";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};

const listJobsSchema = z
  .object({
    status: z.enum(AGENT_JOB_STATUSES).optional(),
    jobType: z
      .string()
      .max(160)
      .regex(/^[a-z][a-z0-9_-]*(\.[a-z][a-z0-9_-]*)+$/)
      .optional(),
    before: z
      .string()
      .refine((value) => !Number.isNaN(new Date(value).getTime()), {
        message: "before must be a valid ISO date-time.",
      })
      .optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: PRIVATE_HEADERS });
}
function routeError(error: unknown): Response {
  const authorizationResponse = adminAuthorizationErrorResponse(error);
  if (authorizationResponse) return authorizationResponse;
  if (isAgentError(error)) {
    return json({ error: error.message, code: error.code }, getAgentErrorHttpStatus(error));
  }
  console.error("Growth-agent jobs route failed");
  return json({ error: "Growth-agent jobs request failed." }, 500);
}

export async function GET(request: Request): Promise<Response> {
  await connection();
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const parsed = listJobsSchema.safeParse(
      Object.fromEntries(url.searchParams.entries())
    );

    if (!parsed.success) {
      return json(
        { error: "Invalid job filters.", details: parsed.error.flatten() },
        400
      );
    }

    const jobs = await listAgentJobs(parsed.data);
    return json({
      jobs,
      nextCursor: jobs.length === parsed.data.limit ? jobs.at(-1)?.created_at ?? null : null,
    });
  } catch (error) {
    return routeError(error);
  }
}
