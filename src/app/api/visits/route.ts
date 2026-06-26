import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET — read the current visit total without incrementing.
export async function GET(): Promise<NextResponse> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("visit_counter")
    .select("count")
    .eq("id", 1)
    .single();

  if (error) {
    console.error("[visits] read error:", error);
    return NextResponse.json({ error: "Failed to read count" }, { status: 500 });
  }

  return NextResponse.json({ count: Number(data.count) });
}

// POST — atomically increment and return the new total.
export async function POST(): Promise<NextResponse> {
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("increment_visit_count");

  if (error) {
    console.error("[visits] increment error:", error);
    return NextResponse.json({ error: "Failed to increment count" }, { status: 500 });
  }

  return NextResponse.json({ count: Number(data) });
}
