import { z } from "zod";
import {
  adminAuthorizationErrorResponse,
  requireAdmin,
} from "@/lib/admin/authorization";
import {
  getAgentErrorHttpStatus,
  isAgentError,
} from "@/lib/growth-agents/errors";
import { reviewCandidate } from "@/lib/products/candidates";
import { candidateActionSchema } from "@/lib/sources/types";

type Context = { params: Promise<{ id: string }> };

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
  if (isAgentError(error)) {
    return json(
      {
        error: error.message,
        code: error.code,
        retryable: error.retryable,
        details: error.details,
      },
      getAgentErrorHttpStatus(error)
    );
  }
  console.error("Product candidate review route failed", error);
  return json({ error: "Product candidate review failed." }, 500);
}

export async function PATCH(request: Request, context: Context): Promise<Response> {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    if (!z.uuid().safeParse(id).success) {
      return json({ error: "Invalid candidate ID." }, 400);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON body." }, 400);
    }
    const parsed = candidateActionSchema.safeParse(body);
    if (!parsed.success) {
      return json(
        { error: "Invalid review action.", details: parsed.error.flatten() },
        400
      );
    }

    const candidate = await reviewCandidate(id, parsed.data, admin.email);
    return json({ candidate });
  } catch (error) {
    return routeError(error);
  }
}
