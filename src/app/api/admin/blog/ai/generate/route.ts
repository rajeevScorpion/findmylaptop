import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBlogFlags } from "@/lib/flags";
import { blogGenerateInputSchema } from "@/lib/blog/schemas";
import { getCategories } from "@/lib/blog/queries";
import { getPersonaById, toPersonaOption } from "@/lib/personas/service";
import type { PersonaOption } from "@/lib/personas/types";
import {
  generateBlogOutline,
  generateBlogDraft,
  generateBlogFull,
  generateBlogMetadata,
  generateBlogFaqs,
  improveBlogSection,
  getBlogWriterModel,
  BLOG_WRITER_PROMPT_VERSION,
  type AiUsage,
  type BlogWriterPersonaContext,
} from "@/lib/ai/blog-writer";

function isAdminEmail(email: string): boolean {
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes(email.toLowerCase());
}

// Log AI generation metadata only — never keys, secrets, or raw output.
async function logGeneration(row: {
  generation_type: string;
  output_status: string;
  input_topic?: string;
  input_brief?: string;
  input_keywords?: string[];
  error_message?: string;
  created_by?: string;
  usage?: AiUsage;
}) {
  try {
    const supabase = createAdminClient();
    await supabase.from("ai_generation_logs").insert({
      generation_type: row.generation_type,
      model: getBlogWriterModel(),
      prompt_version: BLOG_WRITER_PROMPT_VERSION,
      input_topic: row.input_topic ?? null,
      input_brief: row.input_brief ?? null,
      input_keywords: row.input_keywords ?? [],
      output_status: row.output_status,
      error_message: row.error_message ?? null,
      tokens_input: row.usage?.tokens_input ?? null,
      tokens_output: row.usage?.tokens_output ?? null,
      tokens_cached: row.usage?.tokens_cached ?? null,
      created_by: row.created_by ?? null,
    });
  } catch {
    // Logging must never break generation.
    console.error("ai_generation_logs insert failed");
  }
}

export async function POST(request: NextRequest) {
  // 1. Admin auth (same pattern as /api/admin/process-laptop)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminEmail(user.email ?? ""))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // 2. Feature flag gate
  const flags = await getBlogFlags();
  if (!flags.blog_enabled || !flags.ai_blog_writer_enabled) {
    return NextResponse.json(
      { error: "AI writer is disabled by admin." },
      { status: 403 }
    );
  }

  // 3. Validate input
  let parsedInput;
  try {
    parsedInput = blogGenerateInputSchema.safeParse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!parsedInput.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsedInput.error.flatten() },
      { status: 400 }
    );
  }
  const input = parsedInput.data;

  let personaContext: BlogWriterPersonaContext | undefined;
  let resolvedPersona: PersonaOption | null = null;
  if (input.authorPersonaId) {
    let persona;
    try {
      persona = await getPersonaById(input.authorPersonaId);
    } catch {
      console.error("blog AI persona lookup failed");
      return NextResponse.json(
        { error: "The author persona could not be loaded." },
        { status: 500 }
      );
    }
    if (!persona || persona.status !== "active" || !persona.permissions.canWriteBlogs) {
      return NextResponse.json(
        { error: "That author persona is not active or cannot write blog posts." },
        { status: 409 }
      );
    }
    const generatesArticleContent = input.generationType !== "metadata";
    if (
      generatesArticleContent &&
      input.includeProducts &&
      !persona.permissions.canInsertProductCards
    ) {
      return NextResponse.json(
        { error: "That author persona is not permitted to insert product cards." },
        { status: 409 }
      );
    }
    if (
      generatesArticleContent &&
      input.templateType === "comparison_guide" &&
      !persona.permissions.canWriteComparisons
    ) {
      return NextResponse.json(
        { error: "That author persona is not permitted to write comparisons." },
        { status: 409 }
      );
    }
    personaContext = {
      id: persona.id,
      version: persona.version,
      displayName: persona.displayName,
      publicRole: persona.publicRole,
      authorType: persona.authorType,
      disclosureText: persona.disclosureText,
      expertiseTags: persona.expertiseTags,
      toneSettings: persona.toneSettings,
      buyingPhilosophy: persona.buyingPhilosophy,
      writingDos: persona.writingDos,
      writingDonts: persona.writingDonts,
      writingGuidance: persona.personaSystemPrompt,
      affiliatePolicy: persona.affiliatePolicy,
      permissions: {
        canWriteComparisons: persona.permissions.canWriteComparisons,
        canInsertProductCards: persona.permissions.canInsertProductCards,
        alwaysRequiresManualReview: persona.permissions.alwaysRequiresManualReview,
      },
    };
    resolvedPersona = toPersonaOption(persona);
  }

  // For category-aware generations, supply the existing category names so the
  // model can only ever *suggest* one of the admin's real categories.
  if (input.generationType === "full" || input.generationType === "metadata") {
    try {
      const categories = await getCategories();
      input.availableCategories = categories.map((c) => c.name);
    } catch {
      // Non-fatal — generation proceeds without a category suggestion.
    }
  }

  // 4. Generate
  try {
    const writerInput = { ...input, personaContext };
    let result: { data: unknown; usage: AiUsage };
    switch (input.generationType) {
      case "outline":
        result = await generateBlogOutline(writerInput);
        break;
      case "draft":
        result = await generateBlogDraft(writerInput);
        break;
      case "full":
        result = await generateBlogFull(writerInput);
        break;
      case "metadata":
        result = await generateBlogMetadata(writerInput);
        break;
      case "faqs":
        result = await generateBlogFaqs(writerInput);
        break;
      case "section":
        result = await improveBlogSection(writerInput);
        break;
      default:
        return NextResponse.json({ error: "Unknown generation type" }, { status: 400 });
    }

    await logGeneration({
      generation_type: input.generationType,
      output_status: "success",
      input_topic: input.topic,
      input_brief: input.brief,
      input_keywords: [input.primaryKeyword, ...input.secondaryKeywords].filter(Boolean),
      created_by: user.email ?? undefined,
      usage: result.usage,
    });

    return NextResponse.json({ result: result.data, persona: resolvedPersona });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    const status = (err as { status?: number })?.status;

    let message = "Draft generation failed. Please retry or edit manually.";
    let httpStatus = 502;
    if (code === "missing_key") {
      message = "OpenAI API key is missing on the server.";
      httpStatus = 500;
    } else if (code === "invalid_format") {
      message = "The generated response did not match the expected format.";
      httpStatus = 502;
    } else if (status === 429) {
      message = "Rate limit reached. Try again later.";
      httpStatus = 429;
    }

    // Provider errors can include request metadata. Log only bounded
    // operational fields, never the prompt, generated output, or credentials.
    console.error("blog AI generation failed", {
      code: typeof code === "string" ? code.slice(0, 120) : undefined,
      status: typeof status === "number" ? status : undefined,
    });
    await logGeneration({
      generation_type: input.generationType,
      output_status: code === "invalid_format" ? "invalid" : "error",
      input_topic: input.topic,
      input_brief: input.brief,
      input_keywords: [input.primaryKeyword, ...input.secondaryKeywords].filter(Boolean),
      error_message: message,
      created_by: user.email ?? undefined,
    });

    return NextResponse.json({ error: message }, { status: httpStatus });
  }
}
