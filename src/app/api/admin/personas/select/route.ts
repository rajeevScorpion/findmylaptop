import { NextRequest, NextResponse } from "next/server";
import { getPersonaAdminEmail } from "@/lib/personas/admin-auth";
import { personaSelectionInputSchema } from "@/lib/personas/schemas";
import { selectPersonaForTopic, toPersonaOption } from "@/lib/personas/service";

export async function POST(request: NextRequest) {
  const adminEmail = await getPersonaAdminEmail();
  if (!adminEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let parsed;
  try {
    parsed = personaSelectionInputSchema.safeParse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json({ error: "A topic is required." }, { status: 400 });
  }
  try {
    const selection = await selectPersonaForTopic(parsed.data);
    if (!selection) {
      return NextResponse.json({ error: "No active writing persona is available." }, { status: 409 });
    }
    return NextResponse.json({
      selection: {
        persona: toPersonaOption(selection.persona),
        reason: selection.reason,
        score: selection.score,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not select persona" },
      { status: 500 }
    );
  }
}
