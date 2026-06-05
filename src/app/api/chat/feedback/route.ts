import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface FeedbackRequest {
  session_id: string;
  rating: boolean;
  comment?: string;
  transcript?: { role: string; content: string }[];
  recommended_slugs?: string[];
  message_count?: number;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: FeedbackRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { session_id, rating, comment, transcript, recommended_slugs, message_count } = body;

  if (!session_id || typeof rating !== "boolean") {
    return NextResponse.json({ error: "session_id and rating are required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Verify session exists
  const { data: session } = await supabase
    .from("chat_sessions")
    .select("session_id")
    .eq("session_id", session_id)
    .single();

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Upsert so re-rating a session just updates it
  const { error } = await supabase.from("session_feedback").upsert(
    {
      session_id,
      rating,
      comment: comment?.trim() || null,
      transcript: transcript ?? null,
      recommended_slugs: recommended_slugs ?? [],
      message_count: message_count ?? 0,
    },
    { onConflict: "session_id" }
  );

  if (error) {
    console.error("[feedback] insert error:", error);
    return NextResponse.json({ error: "Failed to save feedback" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
