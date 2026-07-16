import { NextRequest, NextResponse } from "next/server";
import { getPersonaAdminEmail } from "@/lib/personas/admin-auth";
import { personaPreviewInputSchema } from "@/lib/personas/schemas";
import { getPersonaById, previewPersona } from "@/lib/personas/service";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  const adminEmail = await getPersonaAdminEmail();
  if (!adminEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let parsed;
  try {
    parsed = personaPreviewInputSchema.safeParse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a topic of at least three characters." },
      { status: 400 }
    );
  }
  try {
    const persona = await getPersonaById((await params).id);
    if (!persona) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const preview = await previewPersona(persona, parsed.data.topic, adminEmail);
    return NextResponse.json({ preview });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not preview persona" },
      { status: 500 }
    );
  }
}
