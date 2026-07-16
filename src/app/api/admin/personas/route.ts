import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getPersonaAdminEmail } from "@/lib/personas/admin-auth";
import { personaInputSchema } from "@/lib/personas/schemas";
import { createPersona, listPersonas } from "@/lib/personas/service";

export async function GET(request: NextRequest) {
  const adminEmail = await getPersonaAdminEmail();
  if (!adminEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const personas = await listPersonas({
      includeSoftDeleted: request.nextUrl.searchParams.get("includeDeleted") === "true",
    });
    return NextResponse.json({ personas });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load personas" },
      { status: 500 }
    );
  }
}
export async function POST(request: NextRequest) {
  const adminEmail = await getPersonaAdminEmail();
  if (!adminEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let parsed;
  try {
    parsed = personaInputSchema.safeParse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid persona", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  try {
    const persona = await createPersona(parsed.data, adminEmail);
    revalidateTag("personas", { expire: 0 });
    return NextResponse.json({ persona }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create persona";
    return NextResponse.json(
      { error: message.includes("duplicate") ? "That persona slug is already in use." : message },
      { status: message.includes("duplicate") ? 409 : 500 }
    );
  }
}
