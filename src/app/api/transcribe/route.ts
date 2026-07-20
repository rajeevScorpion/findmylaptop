import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getGrowthAgentModel } from "@/lib/growth-agents/models";

// Cap uploads so a runaway recording can't blow up the request / API bill.
const MAX_BYTES = 10 * 1024 * 1024; // ~10 MB

export async function POST(request: NextRequest): Promise<NextResponse> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Audio too long" }, { status: 400 });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const result = await openai.audio.transcriptions.create({
      file,
      model: getGrowthAgentModel("transcription"),
    });
    return NextResponse.json({ text: result.text ?? "" });
  } catch {
    // Provider errors can contain request metadata. Never log audio or output.
    console.error("Audio transcription request failed");
    return NextResponse.json({ error: "Transcription failed" }, { status: 502 });
  }
}
