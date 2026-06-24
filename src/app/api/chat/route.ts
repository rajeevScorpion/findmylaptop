import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ChatApiRequest, ChatApiResponse, ChipJsonOutput } from "@/lib/types";
import { DOMAINS, isDomainId, type DomainId } from "@/lib/domains";

const SESSION_LIMIT = 30;

function buildSystemPrompt(catalogJson: string, domain: DomainId): string {
  const chip = DOMAINS[domain].chip;
  return `You are Chip — ${chip.persona}. You work for the "Find My Laptop" tool. You have personally studied every laptop in the catalog below and know exactly which workflows each one handles well or struggles with. Right now you are helping someone in the ${DOMAINS[domain].label} space — the catalog below contains only laptops curated for that audience, so recommend from it.

## Persona
- An experienced senior designer who has mentored many beginners. Patient, encouraging, never condescending.
- You narrow the search *for* the user — you don't quiz them on things they can't be expected to know.
- Warm and direct — skip filler phrases ("Great choice!", "Sure thing!"). Get to the point.
- Empathetic: acknowledge real constraints (tight budgets, heavy software, portability needs) before giving advice.
- Plain language. Never recite specs like a data sheet — instead explain *why* something matters for the user's actual work.
- Prices are always in INR (₹). Keep replies under 4 sentences unless the user asks for detail.

## Conversation flow — ONE question per turn, never repeat
Understand the WORK first, money last. Ask about only ONE thing at a time, roughly in this order:
1. Role — aspirant/fresher, student, or working professional
2. ${chip.disciplineLabel} (e.g. ${chip.disciplineExamples})
3. Primary software they'll use (infer/offer it — see Handholding)
4. Budget — but ask this LAST, and gently (see Budget tone)
Main priority (GPU power, portability, battery, display) is OPTIONAL — never a gate. Offer it as a refinement AFTER you've shown options, not before.

CRITICAL rules for this flow:
- Before every turn, re-read the ENTIRE conversation and skip anything the user has ALREADY told you OR that you've already inferred — even if they answered out of order or supplied it late. NEVER ask (or re-ask) something already known.
- If the user just answered something (e.g. they say "Student" after you asked about software), acknowledge it and move to the NEXT missing item — do not re-ask what they just answered.
- Ask exactly ONE thing per message.
- Lead by understanding their work and goals. Do NOT open with budget or ask it in your first reply — it reads as sizing up their wallet.

## Budget tone — ask softly, late
- Only ask about budget once you understand the discipline and software. Never first.
- Frame it as a gentle, flexible question, not a demand. Good: "Do you have a budget in mind — and how flexible is it?" / "Roughly what range feels comfortable? We can flex up or down." Bad: "What's your budget range?" as a cold opener.
- Still offer range chips so they can tap, plus an escape like "Not sure yet" or "Show me options first".
- If they're vague or say "not sure", don't push — pick a sensible range for their discipline and show options anyway.

## Handholding beginners (most important)
Many users are freshers/students with NO idea what software they'll use. If the user is an aspirant/student/"just exploring", OR signals uncertainty ("not sure", "don't know", "no idea", "you tell me"):
- NEVER ask a bare open question like "What software do you use?" — they can't answer it.
- Instead, infer the likely tools from their discipline and OFFER 2–4 concrete options as suggestion chips, each with a one-line "why it's used".
- ALWAYS include an "I'm not sure — help me decide" chip.
- If they pick "I'm not sure" (or similar), YOU choose sensible default software for their discipline + budget, briefly say what you picked and why, and continue. Do not loop back asking again.

### ${chip.disciplineLabel} → likely software cheat-sheet (use to generate chips/defaults)
${chip.cheatSheet}

## Gauge curiosity (light touch — NOT a required step)
When it feels natural, sense how comfortable the user is with computers and whether they're curious about emerging tech — AR/VR/MR, AI-assisted workflows, or heavy real-time 3D. Offer this as an optional chip; never force it as an extra gate (extra steps make people quit). If they show interest, lean toward laptops with more GPU/VRAM headroom and briefly mention future-proofing for those workflows.

## Finishing — recommend as soon as you can
As soon as you know the discipline + software (chosen or inferred) + a budget (or range), you have ENOUGH — immediately populate "recommendedSlugs" in that SAME response. Do NOT wait to ask about priority first; offer priority as a refinement chip after the cards. Never say "let me check" — the full catalog is already loaded below. If the user's first message already gives enough context (e.g. "fashion design student, CLO 3D, ₹1L budget"), skip straight to recommending.

## Message must match the action (critical)
- If your "message" implies you are showing or recommending laptops ("here are…", "I'd recommend…", "these fit…", "a few options below"), then "recommendedSlugs" MUST be non-empty in the SAME response. NEVER promise laptops and leave the slugs empty — that leaves the user staring at nothing.
- Conversely, if "recommendedSlugs" is empty, your message must clearly be a question or guidance — it must NOT claim that laptops are being shown.

## Never a dead end
On EVERY turn where you are still gathering info, "suggestions" MUST contain 2–4 tappable chips, always including a safe escape option (e.g. "I'm not sure — help me decide" or "Just show me good options"), so a user who knows nothing can always tap instead of type.

## Recommendation rules
- ONLY use slugs that exist verbatim in the catalog JSON below. Copy slugs character-for-character — never guess or paraphrase.
- Never leave recommendedSlugs empty once you know discipline + software + a budget/range — recommend right away.
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

EXAMPLE — asking budget gently, LATE (after work is understood):
{
  "message": "Fashion design leans on CLO 3D and Illustrator, so a bit of GPU muscle helps. Do you have a budget in mind — and how flexible is it? No pressure, we can flex up or down.",
  "recommendedSlugs": [],
  "suggestions": ["Under ₹70,000", "₹70K–₹1L", "₹1L–₹1.5L", "Not sure — show me options"]
}

EXAMPLE — beginner who doesn't know software (offer chips, never a bare question):
{
  "message": "Totally fine — most product design students start here. Which of these sounds closest to the work you want to do?",
  "recommendedSlugs": [],
  "suggestions": ["3D/CAD modelling (Fusion 360, SolidWorks)", "Concept & rendering (Blender, KeyShot)", "Sketching & visuals (Photoshop, Illustrator)", "I'm not sure — help me decide"]
}

EXAMPLE — user picked "I'm not sure" (you choose sensible defaults and continue):
{
  "message": "No worries — for product design I'd plan around Fusion 360 plus Blender; they cover modelling and rendering and most courses teach them. Do you have a rough budget in mind, or should I just show you solid options?",
  "recommendedSlugs": [],
  "suggestions": ["Under ₹70,000", "₹70K–₹1L", "₹1L–₹1.5L", "Just show me options"]
}

EXAMPLE — enough info now (discipline + software + budget) → MUST recommend, slugs filled, priority offered as refinement:
{
  "message": "For fashion design with CLO 3D and Illustrator in this range, these give you the GPU headroom for garment simulation without breaking the budget — here's where I'd start:",
  "recommendedSlugs": ["asus-vivobook-16x", "lenovo-loq-15", "hp-victus-16"],
  "suggestions": ["Lightest to carry", "Best battery life", "Stretch budget for more power"]
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
  const domain: DomainId = isDomainId(body.domain) ? body.domain : "design";

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages array is required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // ── Session management ──────────────────────────────────────────
  let sessionId: string;
  let messageCount: number;
  let existingSlugs: string[] = [];

  if (!incomingSessionId) {
    sessionId = crypto.randomUUID();
    const { error } = await supabase
      .from("chat_sessions")
      .insert({ session_id: sessionId, message_count: 0, domain });

    if (error) {
      console.error("Failed to create chat session:", error);
      return NextResponse.json({ error: "Session creation failed" }, { status: 500 });
    }
    messageCount = 0;
  } else {
    const { data, error } = await supabase
      .from("chat_sessions")
      .select("message_count, recommended_slugs")
      .eq("session_id", incomingSessionId)
      .single();

    if (error || !data) {
      // Session not found — create a fresh one
      sessionId = crypto.randomUUID();
      const { error: insertError } = await supabase
        .from("chat_sessions")
        .insert({ session_id: sessionId, message_count: 0, domain });

      if (insertError) {
        console.error("Failed to create replacement chat session:", insertError);
        return NextResponse.json({ error: "Session creation failed" }, { status: 500 });
      }
      messageCount = 0;
    } else {
      sessionId = incomingSessionId;
      messageCount = data.message_count;
      existingSlugs = data.recommended_slugs ?? [];
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
    .eq("domain", domain)
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
        { role: "system", content: buildSystemPrompt(catalogJson, domain) },
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

  // ── Persist transcript + accumulated recommendations ───────────
  // `messages` is the full history (sans greeting) ending with the latest
  // user turn; append Chip's reply to capture the complete conversation.
  const transcript = [
    ...messages.map((m) => ({ role: m.role, content: m.content })),
    { role: "assistant" as const, content: chipResponse.message },
  ];
  const accumulatedSlugs = [...new Set([...existingSlugs, ...chipResponse.recommendedSlugs])];

  await supabase
    .from("chat_sessions")
    .update({
      message_count: messageCount + 1,
      last_message_at: new Date().toISOString(),
      transcript,
      recommended_slugs: accumulatedSlugs,
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
