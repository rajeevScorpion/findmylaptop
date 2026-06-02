import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { processedLaptopInputSchema } from "@/lib/schemas";
import {
  extractAsin,
  fetchProductByAsin,
  buildAffiliateUrl,
  productToText,
  AmazonApiError,
} from "@/lib/amazon-creators";

function isAdminEmail(email: string): boolean {
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes(email.toLowerCase());
}

const SYSTEM_PROMPT = `You are a laptop specification extraction assistant helping design students choose the right laptop.

Extract structured laptop data from the provided raw text (Amazon product page, copy-pasted specifications, or product descriptions).

Return a JSON object with ONLY these fields (omit any field you cannot determine from the source):
- name: full product name
- brand: manufacturer name
- model: specific model name/number
- price_approx: approximate price as integer in INR (if mentioned)
- price_label: formatted price string like "₹89,990"
- cpu: full CPU name
- gpu: full GPU name (NVIDIA/AMD discrete GPU if present, otherwise integrated)
- gpu_vram_gb: GPU VRAM in GB as a number
- ram: RAM description like "16GB DDR5 5200MHz"
- ram_gb: RAM amount as integer
- storage: storage description like "512GB NVMe SSD"
- storage_gb: storage amount as integer
- display: display description including size, resolution, refresh rate, colour coverage
- weight: weight with unit like "2.2kg"
- os: operating system
- tier: one of "budget", "value", "balanced", "advanced", "premium" based on specs and price
- workload_tags: array of applicable tags from: ["2d", "uiux", "video", "fashion", "interior", "product", "animation", "game", "3d", "ai", "coding", "rendering"]
- recommended_for_courses: array of course names from: ["Fashion Design & Technology", "Fashion Communication & Styling", "Luxury & Brand Management", "Communication Design", "Digital Design", "Product & Service Design", "Interaction Design", "Transportation & Mobility Design", "Game Art", "Game Design / Programming", "Animation & Film Making", "Interior Architecture & Design", "AI in Creative Practice", "Global Design Programme"]
- not_ideal_for: array of course names this laptop is NOT suitable for
- why_recommended: 2-3 sentence student-friendly explanation of why this laptop suits design work. Focus on GPU, RAM, and practical creative workflow benefits.
- cautions: honest limitations in 1-2 sentences. Mention weak GPU if VRAM < 6GB, soldered RAM if known, thermal throttling concerns for thin laptops with powerful GPUs, heavy weight, older CPU, or poor display colour accuracy.
- upgrade_notes: upgrade possibilities (RAM slots, M.2 slots) if known
- four_year_suitability: one of "basic", "good", "strong", "excellent" based on specs for 4 years of design education
- priority_score: integer 0-100 reflecting overall recommendation strength for design students

Rules:
- Extract only what is present or strongly inferable. Do not fabricate specific clock speeds or benchmark scores.
- Convert VRAM, RAM, and storage to numeric GB values.
- Be honest in cautions — students make 4-year purchasing decisions.
- Write why_recommended and cautions in plain, student-friendly language.
- Avoid marketing language.`;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminEmail(user.email ?? ""))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let url: string;
  try {
    const body = await request.json();
    url = body.url;
    if (!url || typeof url !== "string" || !url.trim()) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Extract ASIN
  const asin = extractAsin(url.trim());
  if (!asin) {
    return NextResponse.json(
      { error: "Could not extract ASIN from URL. Make sure it is a valid Amazon product link." },
      { status: 400 }
    );
  }

  // Fetch from Amazon Creators API
  let productText: string;
  let imageUrl: string | undefined;
  const affiliateUrl = buildAffiliateUrl(asin);

  try {
    const product = await fetchProductByAsin(asin);
    productText = productToText(product);
    imageUrl = product.imageUrl;
  } catch (err) {
    if (err instanceof AmazonApiError) {
      if (err.status === 401 || err.status === 403) {
        return NextResponse.json(
          {
            error:
              "Amazon Creators API is not yet active on your account. You need 10 qualifying sales in the last 30 days. Paste product details manually instead.",
            code: "API_NOT_ACTIVE",
          },
          { status: 403 }
        );
      }
      return NextResponse.json(
        { error: `Amazon API error: ${err.message}` },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch product from Amazon" },
      { status: 502 }
    );
  }

  // Run through OpenAI
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  let content: string;
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Extract structured laptop data from this Amazon product listing:\n\n${productText}`,
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

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return NextResponse.json({ error: "AI returned invalid JSON" }, { status: 502 });
  }

  const result = processedLaptopInputSchema.safeParse(parsed);
  const data = result.success ? result.data : (parsed as Record<string, unknown>);

  return NextResponse.json({
    ...data,
    image_url: imageUrl,
    amazon_affiliate_url: affiliateUrl,
  });
}
