import { z } from "zod";
import { connection } from "next/server";
import {
  adminAuthorizationErrorResponse,
  requireAdmin,
} from "@/lib/admin/authorization";
import {
  AGENT_SETTING_KEY_LIST,
  type AgentSettingKey,
} from "@/lib/growth-agents/defaults";
import {
  getAgentErrorHttpStatus,
  isAgentError,
} from "@/lib/growth-agents/errors";
import {
  listAgentSettingRows,
  resolveAgentSettings,
  updateAgentSettings,
} from "@/lib/growth-agents/settings";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};

const settingKeySchema = z.enum(
  [...AGENT_SETTING_KEY_LIST] as [AgentSettingKey, ...AgentSettingKey[]]
);

const updateSettingsSchema = z
  .object({
    updates: z
      .array(
        z
          .object({
            key: settingKeySchema,
            value: z.union([z.boolean(), z.number().int()]),
          })
          .strict()
      )
      .min(1)
      .max(AGENT_SETTING_KEY_LIST.length),
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
  console.error("Growth-agent settings route failed");
  return json({ error: "Growth-agent settings request failed." }, 500);
}

export async function GET(): Promise<Response> {
  await connection();
  try {
    await requireAdmin();
    const settings = await listAgentSettingRows();
    return json({ settings, effective: resolveAgentSettings(settings) });
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

    const parsed = updateSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return json(
        { error: "Invalid settings update.", details: parsed.error.flatten() },
        400
      );
    }

    await updateAgentSettings(parsed.data.updates, admin.email);
    const settings = await listAgentSettingRows();
    return json({ settings, effective: resolveAgentSettings(settings) });
  } catch (error) {
    return routeError(error);
  }
}
