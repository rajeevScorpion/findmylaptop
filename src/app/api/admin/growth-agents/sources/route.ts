import { z } from "zod";
import {
  adminAuthorizationErrorResponse,
  requireAdmin,
} from "@/lib/admin/authorization";
import {
  getAgentErrorHttpStatus,
  isAgentError,
} from "@/lib/growth-agents/errors";
import {
  listSourceAdapters,
  updateSourceAdapter,
} from "@/lib/growth-agents/settings";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};

const updateSourceSchema = z
  .object({
    sourceKey: z.string().regex(/^[a-z][a-z0-9_-]{1,63}$/),
    enabled: z.boolean().optional(),
    freshnessTtlMinutes: z.number().int().min(5).max(10080).optional(),
    publicDisplayAllowed: z.boolean().optional(),
    requiresAdminApproval: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.enabled !== undefined ||
      value.freshnessTtlMinutes !== undefined ||
      value.publicDisplayAllowed !== undefined ||
      value.requiresAdminApproval !== undefined,
    { message: "Provide at least one source setting to update." }
  );

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: PRIVATE_HEADERS });
}
function routeError(error: unknown): Response {
  const authorizationResponse = adminAuthorizationErrorResponse(error);
  if (authorizationResponse) return authorizationResponse;
  if (isAgentError(error)) {
    return json({ error: error.message, code: error.code }, getAgentErrorHttpStatus(error));
  }
  console.error("Growth-agent sources route failed", error);
  return json({ error: "Source adapter request failed." }, 500);
}

export async function GET(): Promise<Response> {
  try {
    await requireAdmin();
    return json({ sources: await listSourceAdapters() });
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

    const parsed = updateSourceSchema.safeParse(body);
    if (!parsed.success) {
      return json(
        { error: "Invalid source adapter update.", details: parsed.error.flatten() },
        400
      );
    }

    const { sourceKey, ...update } = parsed.data;
    const source = await updateSourceAdapter(sourceKey, update, admin.email);
    return json({ source });
  } catch (error) {
    return routeError(error);
  }
}
