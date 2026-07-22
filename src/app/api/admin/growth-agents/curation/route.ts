import { z } from "zod";
import { requireAdmin, adminAuthorizationErrorResponse } from "@/lib/admin/authorization";
import { getAgentErrorHttpStatus, isAgentError } from "@/lib/growth-agents/errors";
import {
  auditProductCatalog,
  compileAndActivateRulebook,
  getProductCurationSchedule,
  listCurationProposals,
  listProductRulebooks,
  persistCatalogAuditProposals,
  reviewCurationProposal,
  saveProductCurationSchedule,
  saveProductRulebook,
} from "@/lib/product-curation/service";
import { runProductDiscovery, runProductRefresh } from "@/lib/product-curation/orchestrator";
import { rulebookUpdateSchema, scheduleUpdateSchema } from "@/lib/product-curation/types";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store", Vary: "Cookie" };
export const maxDuration = 300;
const domainSchema = z.enum(["design", "technology", "management"]);
const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save_rulebook"), value: rulebookUpdateSchema }).strict(),
  z.object({ action: z.literal("compile_rulebook"), domain: domainSchema }).strict(),
  z.object({ action: z.literal("save_schedule"), value: scheduleUpdateSchema }).strict(),
  z.object({ action: z.literal("audit_domain"), domain: domainSchema }).strict(),
  z.object({ action: z.literal("run_discovery") }).strict(),
  z.object({ action: z.literal("run_refresh") }).strict(),
  z.object({
    action: z.literal("review_proposal"),
    id: z.uuid(),
    decision: z.enum(["approve", "reject"]),
    adminNotes: z.string().trim().max(4000).nullable().default(null),
  }).strict(),
]);

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: PRIVATE_HEADERS });
}

function routeError(error: unknown): Response {
  const authorization = adminAuthorizationErrorResponse(error);
  if (authorization) return authorization;
  if (isAgentError(error)) {
    return json({ error: error.message, code: error.code, retryable: error.retryable, details: error.details }, getAgentErrorHttpStatus(error));
  }
  if (error instanceof z.ZodError) return json({ error: "Invalid product curation request.", details: error.flatten() }, 400);
  console.error("Product curation admin route failed");
  return json({ error: error instanceof Error ? error.message : "Product curation request failed." }, 500);
}

export async function GET(): Promise<Response> {
  try {
    await requireAdmin();
    const [rulebooks, schedule, proposals] = await Promise.all([
      listProductRulebooks(),
      getProductCurationSchedule(),
      listCurationProposals(),
    ]);
    return json({ rulebooks, schedule, proposals });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const admin = await requireAdmin();
    let body: unknown;
    try { body = await request.json(); }
    catch { return json({ error: "Invalid JSON body." }, 400); }
    const parsed = actionSchema.parse(body);
    switch (parsed.action) {
      case "save_rulebook":
        return json({ rulebook: await saveProductRulebook(parsed.value, admin.email) });
      case "compile_rulebook":
        return json({ rulebook: await compileAndActivateRulebook(parsed.domain, admin.email) });
      case "save_schedule":
        return json({ schedule: await saveProductCurationSchedule(parsed.value, admin.email) });
      case "audit_domain": {
        const audit = await auditProductCatalog(parsed.domain);
        const proposalsCreated = await persistCatalogAuditProposals(audit, null);
        return json({ audit, proposalsCreated });
      }
      case "run_discovery":
        return json({ result: await runProductDiscovery({ actorEmail: admin.email, manual: true }) });
      case "run_refresh":
        return json({ result: await runProductRefresh({ actorEmail: admin.email, manual: true }) });
      case "review_proposal":
        return json({ proposal: await reviewCurationProposal(parsed.id, parsed.decision, admin.email, parsed.adminNotes) });
    }
  } catch (error) {
    return routeError(error);
  }
}
