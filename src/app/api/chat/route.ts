import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ChatApiRequest, ChatApiResponse, ChipJsonOutput } from "@/lib/types";

const SESSION_LIMIT = 30;

function buildSystemPrompt(catalogJson: string): string {
  return `You are Chip, a friendly and expert laptop advisor for design school students in India. You work for the "Find My Laptop" tool.

## Persona
- Warm, concise, and honest. Never pushy or salesy.
- Plain student-friendly language, prices always in INR (₹).
- Keep replies short (2–4 sentences) unless explaining something technical.

## Conversation flow
Collect these three things ONE question at a time before recommending:
1. Course / design discipline
2. Budget (in INR)
3. Specific priority (GPU power, portability, battery, display, etc.)

Once you have all three, IMMEDIATELY include matching laptop slugs in "recommendedSlugs" in that same response. Do NOT say "one moment" or "let me search" — the catalog is already loaded below and you must pick from it right now.

If the user's message already contains enough context (e.g. they say "game design, under 1 lac, best GPU"), skip straight to recommending.

## Critical rules
- ONLY use slugs that exist verbatim in the catalog JSON below. Copy them exactly — no guessing, no paraphrasing.
- Never say "I'll find options" and leave recommendedSlugs empty when you already have course + budget + priority. That is incorrect behaviour.
- Recommend up to 3 laptops. Briefly explain why each suits the student's needs.
- If no laptop fits, recommend the closest and honestly explain the compromise.
- For general hardware questions (e.g. "what is VRAM?") answer helpfully without pushing a product.
- Be honest about budget constraints — if ₹50,000 cannot cover a course's needs, say so.

## Response format — ONLY return this JSON, nothing else:
{
  "message": "Your reply text. Short and conversational.",
  "recommendedSlugs": [],
  "suggestions": []
}

EXAMPLE — still gathering info (no recommendations yet):
{
  "message": "Got it — Game Design. What's your budget range?",
  "recommendedSlugs": [],
  "suggestions": ["Under ₹70,000", "₹70K–₹1L", "₹1L–₹1.5L", "Above ₹1.5L"]
}

EXAMPLE — all info collected, must include slugs:
{
  "message": "For Game Design with a ₹1L budget and max GPU priority, here are your best options:",
  "recommendedSlugs": ["asus-tuf-gaming-f15", "lenovo-loq-15", "hp-victus-16"],
  "suggestions": ["Tell me more about the top pick", "Show MacBook options", "I need better portability"]
}

## Laptop catalog (use these slugs exactly)
${catalogJson}`;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: ChatApiRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { messages, sessionId: incomingSessionId } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages array is required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // ── Session management ──────────────────────────────────────────
  let sessionId: string;
  let messageCount: number;

  if (!incomingSessionId) {
    sessionId = crypto.randomUUID();
    const { error } = await supabase
      .from("chat_sessions")
      .insert({ session_id: sessionId, message_count: 0 });

    if (error) {
      console.error("Failed to create chat session:", error);
      return NextResponse.json({ error: "Session creation failed" }, { status: 500 });
    }
    messageCount = 0;
  } else {
    const { data, error } = await supabase
      .from("chat_sessions")
      .select("message_count")
      .eq("session_id", incomingSessionId)
      .single();

    if (error || !data) {
      // Session not found — create a fresh one
      sessionId = crypto.randomUUID();
      const { error: insertError } = await supabase
        .from("chat_sessions")
        .insert({ session_id: sessionId, message_count: 0 });

      if (insertError) {
        console.error("Failed to create replacement chat session:", insertError);
        return NextResponse.json({ error: "Session creation failed" }, { status: 500 });
      }
      messageCount = 0;
    } else {
      sessionId = incomingSessionId;
      messageCount = data.message_count;
    }
  }

  // ── Enforce message cap ─────────────────────────────────────────
  if (messageCount >= SESSION_LIMIT) {
    return NextResponse.json<ChatApiResponse>({
      message:
        "You've reached the 30-message limit for this session. Open a new browser tab to start fresh, or browse the full results on the page above.",
      recommendedSlugs: [],
      suggestions: ["View all laptops"],
      sessionId,
      messagesRemaining: 0,
    });
  }

  // ── Fetch laptop catalog ────────────────────────────────────────
  const { data: laptopsRaw } = await supabase
    .from("laptops")
    .select(
      "slug, name, brand, price_label, price_approx, tier, workload_tags, recommended_for_courses, why_recommended, cautions, four_year_suitability, ram_gb, gpu_vram_gb"
    )
    .eq("is_published", true)
    .order("priority_score", { ascending: false });

  const laptops = laptopsRaw ?? [];

  if (laptops.length === 0) {
    return NextResponse.json<ChatApiResponse>({
      message:
        "Sorry, the laptop catalog is currently empty. Please check back soon or ask on WhatsApp for help.",
      recommendedSlugs: [],
      suggestions: ["Ask on WhatsApp"],
      sessionId,
      messagesRemaining: SESSION_LIMIT - (messageCount + 1),
    });
  }

  const catalogJson = JSON.stringify(
    laptops.map((l) => ({
      slug: l.slug,
      name: l.name,
      brand: l.brand,
      price_label: l.price_label,
      price_approx: l.price_approx,
      tier: l.tier,
      workload_tags: l.workload_tags,
      courses: l.recommended_for_courses,
      four_year_suitability: l.four_year_suitability,
      ram_gb: l.ram_gb,
      gpu_vram_gb: l.gpu_vram_gb,
      why: l.why_recommended,
      cautions: l.cautions,
    }))
  );

  // ── Call OpenAI ─────────────────────────────────────────────────
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  let chipResponse: ChipJsonOutput;
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 900,
      messages: [
        { role: "system", content: buildSystemPrompt(catalogJson) },
        ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);

    const validSlugs = new Set(laptops.map((l) => l.slug));
    chipResponse = {
      message:
        typeof parsed.message === "string" && parsed.message.trim()
          ? parsed.message.trim()
          : "Sorry, I had a hiccup. Could you rephrase that?",
      recommendedSlugs: Array.isArray(parsed.recommendedSlugs)
        ? (parsed.recommendedSlugs as unknown[])
            .filter((s): s is string => typeof s === "string" && validSlugs.has(s))
            .slice(0, 3)
        : [],
      suggestions: Array.isArray(parsed.suggestions)
        ? (parsed.suggestions as unknown[])
            .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
            .slice(0, 4)
        : [],
    };
  } catch (err) {
    console.error("OpenAI chat error:", err);
    return NextResponse.json({ error: "AI response failed" }, { status: 502 });
  }

  // ── Increment message count ────────────────────────────────────
  await supabase
    .from("chat_sessions")
    .update({
      message_count: messageCount + 1,
      last_message_at: new Date().toISOString(),
    })
    .eq("session_id", sessionId);

  const messagesRemaining = SESSION_LIMIT - (messageCount + 1);

  return NextResponse.json<ChatApiResponse>({
    message: chipResponse.message,
    recommendedSlugs: chipResponse.recommendedSlugs,
    suggestions: chipResponse.suggestions,
    sessionId,
    messagesRemaining,
  });
}
