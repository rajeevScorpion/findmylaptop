import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { processedLaptopInputSchema } from "@/lib/schemas";
import { buildExtractionPrompt } from "@/lib/extractionPrompt";
import { getTaxonomy } from "@/lib/taxonomy";
import { isDomainId, type DomainId } from "@/lib/domains";
import {
  resolveAsin,
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

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminEmail(user.email ?? ""))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let url: string;
  let domain: DomainId = "design";
  try {
    const body = await request.json();
    url = body.url;
    if (isDomainId(body.domain)) domain = body.domain;
    if (!url || typeof url !== "string" || !url.trim()) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Extract ASIN (follows amzn.to / a.co short links when needed)
  const asin = await resolveAsin(url.trim());
  if (!asin) {
    return NextResponse.json(
      { error: "Could not extract ASIN from URL. Make sure it is a valid Amazon product link." },
      { status: 400 }
    );
  }

  // Fetch from Amazon Creators API
  let productText: string;
  let imageUrl: string | undefined;
  let priceApprox: number | undefined;
  let priceLabel: string | undefined;
  const affiliateUrl = buildAffiliateUrl(asin);

  try {
    const product = await fetchProductByAsin(asin);
    productText = productToText(product);
    imageUrl = product.imageUrl;
    priceApprox = product.priceAmount;
    priceLabel = product.price;
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
  const { allCourses } = await getTaxonomy(domain);
  const systemPrompt = buildExtractionPrompt(domain, allCourses);

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
    // The API's structured price is authoritative — prefer it over the model's
    // text-parsed guess, but keep the guess as a fallback if the API omitted it.
    price_approx: priceApprox ?? data.price_approx,
    price_label: priceLabel ?? data.price_label,
    image_url: imageUrl,
    amazon_affiliate_url: affiliateUrl,
  });
}
