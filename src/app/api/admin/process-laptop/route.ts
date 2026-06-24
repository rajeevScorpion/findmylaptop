import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { processedLaptopInputSchema } from "@/lib/schemas";
import { buildExtractionPrompt } from "@/lib/extractionPrompt";
import { getTaxonomy } from "@/lib/taxonomy";
import { isDomainId, type DomainId } from "@/lib/domains";

function isAdminEmail(email: string): boolean {
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes(email.toLowerCase());
}

export async function POST(request: NextRequest) {
  // Verify admin session
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdminEmail(user.email ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Parse request body
  let rawInput: string;
  let domain: DomainId = "design";
  try {
    const body = await request.json();
    rawInput = body.rawInput;
    if (isDomainId(body.domain)) domain = body.domain;
    if (!rawInput || typeof rawInput !== "string" || rawInput.trim().length === 0) {
      return NextResponse.json({ error: "rawInput is required" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { allCourses } = await getTaxonomy(domain);
  const systemPrompt = buildExtractionPrompt(domain, allCourses);

  // Call OpenAI
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  let content: string;
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Extract structured laptop data from this:\n\n${rawInput.trim()}`,
        },
      ],
      temperature: 0.1,
    });

    content = completion.choices[0]?.message?.content ?? "{}";
  } catch (err) {
    console.error("OpenAI error:", err);
    return NextResponse.json(
      { error: "OpenAI processing failed. Check your API key and quota." },
      { status: 502 }
    );
  }

  // Parse and validate
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return NextResponse.json({ error: "AI returned invalid JSON" }, { status: 502 });
  }

  const result = processedLaptopInputSchema.safeParse(parsed);
  if (!result.success) {
    // Return the raw parsed data even if validation is partial — admin will review
    return NextResponse.json(parsed);
  }

  return NextResponse.json(result.data);
}
