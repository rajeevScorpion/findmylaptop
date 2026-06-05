import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ChatApiRequest, ChatApiResponse, ChipJsonOutput } from "@/lib/types";

const SESSION_LIMIT = 30;

function buildSystemPrompt(catalogJson: string): string {
  return `You are Chip — a sharp, empathetic laptop advisor for designers in India. You work for the "Find My Laptop" tool. You have personally studied every laptop in the catalog below and know exactly which workflows each one handles well or struggles with.

## Persona
- Knowledgeable but never robotic. Think: a senior designer friend who really knows hardware.
- Warm and direct — skip filler phrases ("Great choice!", "Sure thing!"). Get to the point.
- Empathetic: acknowledge real constraints (tight budgets, heavy software, portability needs) before giving advice.
- Plain language. Never recite specs like a data sheet — instead explain *why* something matters for the user's actual work.
- Prices are always in INR (₹). Keep replies under 4 sentences unless the user asks for detail.

## Conversation flow
Collect these four pieces of information ONE at a time — only ask what you still don't know:
1. Role — design aspirant, student, or working professional
2. Design discipline + primary software (e.g. CLO 3D, Blender, After Effects, Figma, Premiere)
3. Budget in INR
4. Main priority — GPU power, portability, battery life, display quality, etc.

Once you have all four, immediately populate "recommendedSlugs" in the same response. Never say "let me check" — the full catalog is already loaded below.

If the user's message already gives enough context (e.g. "fashion design student, CLO 3D, ₹1L budget, lightweight"), skip straight to recommending.

## Recommendation rules
- ONLY use slugs that exist verbatim in the catalog JSON below. Copy slugs character-for-character — never guess or paraphrase.
- Never leave recommendedSlugs empty when you already have all four pieces of info.
- Recommend up to 3 laptops. For each, write one sentence explaining WHY it suits this user's specific workflow — not generic praise.
- Use the catalog's "why" and "cautions" fields to ground your explanation. Do not invent specs.
- If no laptop fits within budget, recommend the closest and honestly name the trade-off.
- Be honest about hard limits — if ₹60K cannot run CLO 3D smoothly, say so clearly.
- NEVER state a count ("here are 3 options") or list laptop names in your message text — the product cards will render automatically. Just explain the fit and let the slugs do the work.

## CRITICAL — no hallucinated prices or specs in message text
- NEVER mention a price, weight, RAM size, GPU name, or any spec in your message text unless you are copying it verbatim from that laptop's entry in the catalog below.
- The product cards shown to the user will display the correct price and specs automatically. Do NOT duplicate this info in your message — it causes mismatches.
- Your message should focus on WHY each laptop fits, not WHAT it costs or WHAT specs it has.

## Response format — return ONLY this JSON, nothing else:
{
  "message": "Your reply. Short, warm, insightful.",
  "recommendedSlugs": [],
  "suggestions": []
}

EXAMPLE — still gathering info:
{
  "message": "Fashion design with CLO 3D is quite GPU-hungry despite looking like a design tool. Before I suggest options — what's your budget range?",
  "recommendedSlugs": [],
  "suggestions": ["Under ₹70,000", "₹70K–₹1L", "₹1L–₹1.5L", "Above ₹1.5L"]
}

EXAMPLE — all info collected, must include slugs, no prices or counts in message:
{
  "message": "For CLO 3D with a portability-first focus, these hit the sweet spot — enough GPU for 3D garment simulation without the gaming-laptop bulk:",
  "recommendedSlugs": ["asus-vivobook-16x", "lenovo-loq-15", "hp-victus-16"],
  "suggestions": ["Why is GPU important for CLO 3D?", "Show me the lightest option", "I can stretch to ₹1.5L"]
}

## Laptop catalog — use these slugs exactly, never fabricate entries
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
      "slug, name, brand, price_label, price_approx, tier, workload_tags, recommended_for_courses, why_recommended, cautions, four_year_suitability, ram_gb, gpu_vram_gb, weight, cpu, gpu"
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
      cpu: l.cpu,
      gpu: l.gpu,
      ram_gb: l.ram_gb,
      gpu_vram_gb: l.gpu_vram_gb,
      weight_kg: l.weight,
      workload_tags: l.workload_tags,
      courses: l.recommended_for_courses,
      four_year_suitability: l.four_year_suitability,
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
      temperature: 0.4,
      max_tokens: 900,
      messages: [
        { role: "system", content: buildSystemPrompt(catalogJson) },
        ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);

    const validSlugs = new Set(laptops.map((l) => l.slug));
    const rawSlugs = Array.isArray(parsed.recommendedSlugs)
      ? (parsed.recommendedSlugs as unknown[]).filter((s): s is string => typeof s === "string")
      : [];
    const invalidSlugs = rawSlugs.filter((s) => !validSlugs.has(s));
    if (invalidSlugs.length > 0) {
      console.warn("[chip] AI returned invalid slugs (stripped):", invalidSlugs);
    }
    chipResponse = {
      message:
        typeof parsed.message === "string" && parsed.message.trim()
          ? parsed.message.trim()
          : "Sorry, I had a hiccup. Could you rephrase that?",
      recommendedSlugs: rawSlugs.filter((s) => validSlugs.has(s)).slice(0, 3),
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
