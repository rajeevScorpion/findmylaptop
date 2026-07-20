import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const feedbackRequestSchema = z
  .object({
    session_id: z.uuid(),
    rating: z.boolean(),
    comment: z.string().trim().max(2_000).optional(),
  })
  .strict();

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };

export async function POST(request: NextRequest): Promise<NextResponse> {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const parsed = feedbackRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "A valid session, rating, and bounded comment are required." },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }
  const { session_id, rating, comment } = parsed.data;
  const supabase = createAdminClient();

  const { data: session, error: sessionError } = await supabase
    .from("chat_sessions")
    .select("session_id")
    .eq("session_id", session_id)
    .maybeSingle();

  if (sessionError) {
    console.error("[feedback] session lookup failed", sessionError.code);
    return NextResponse.json(
      { error: "Failed to verify the session" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
  if (!session) {
    return NextResponse.json(
      { error: "Session not found" },
      { status: 404, headers: NO_STORE_HEADERS }
    );
  }

  // The canonical transcript and recommendations are already server-owned on
  // chat_sessions. Never accept duplicate transcript content from the browser.
  const { error } = await supabase.from("session_feedback").upsert(
    {
      session_id,
      rating,
      comment: comment || null,
    },
    { onConflict: "session_id" }
  );

  if (error) {
    console.error("[feedback] insert failed", error.code);
    return NextResponse.json(
      { error: "Failed to save feedback" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json({ ok: true }, { headers: NO_STORE_HEADERS });
}
