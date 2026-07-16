import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getPersonaAdminEmail } from "@/lib/personas/admin-auth";
import { personaActionSchema, personaUpdateSchema } from "@/lib/personas/schemas";
import { applyPersonaAction, getPersonaById, updatePersona } from "@/lib/personas/service";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Context) {
  const adminEmail = await getPersonaAdminEmail();
  if (!adminEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const persona = await getPersonaById((await params).id);
    if (!persona) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ persona });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load persona" },
      { status: 500 }
    );
  }
}
export async function PATCH(request: NextRequest, { params }: Context) {
  const adminEmail = await getPersonaAdminEmail();
  if (!adminEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let parsed;
  try {
    parsed = personaUpdateSchema.safeParse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid persona update", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  try {
    const persona = await updatePersona((await params).id, parsed.data, adminEmail);
    if (!persona) return NextResponse.json({ error: "Not found" }, { status: 404 });
    revalidateTag("personas", { expire: 0 });
    revalidateTag("blog", { expire: 0 });
    return NextResponse.json({ persona });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update persona";
    return NextResponse.json(
      { error: message.includes("duplicate") ? "That persona slug is already in use." : message },
      { status: message.includes("duplicate") ? 409 : 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  const adminEmail = await getPersonaAdminEmail();
  if (!adminEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let parsed;
  try {
    parsed = personaActionSchema.safeParse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid persona action" }, { status: 400 });
  }
  try {
    const result = await applyPersonaAction((await params).id, parsed.data.action, adminEmail);
    if (!result.deleted && !result.persona) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    revalidateTag("personas", { expire: 0 });
    revalidateTag("blog", { expire: 0 });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update persona";
    return NextResponse.json({ error: message }, { status: message.includes("blocked") ? 409 : 500 });
  }
}
