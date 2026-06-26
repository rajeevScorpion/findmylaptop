import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const VALID_TAGS = ["laptops", "blog", "flags", "settings", "taxonomy"] as const;
type ValidTag = (typeof VALID_TAGS)[number];

function isAdminEmail(email: string): boolean {
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes(email.toLowerCase());
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let tag: string;
  try {
    ({ tag } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!VALID_TAGS.includes(tag as ValidTag)) {
    return NextResponse.json({ error: "Invalid tag" }, { status: 400 });
  }

  revalidateTag(tag as ValidTag, { expire: 0 });
  return NextResponse.json({ revalidated: true, tag });
}
