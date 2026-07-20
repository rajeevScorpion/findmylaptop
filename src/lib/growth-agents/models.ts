import "server-only";

export type GrowthAgentModelPurpose =
  | "research"
  | "writer"
  | "chip"
  | "extraction"
  | "transcription";

export type GrowthAgentModels = Readonly<
  Record<GrowthAgentModelPurpose, string>
>;

export const DEFAULT_GROWTH_AGENT_MODELS: GrowthAgentModels = Object.freeze({
  research: "gpt-5.6-terra",
  writer: "gpt-5.6-luna",
  chip: "gpt-5.6-luna",
  extraction: "gpt-5.6-luna",
  transcription: "gpt-4o-mini-transcribe",
});

export const GROWTH_AGENT_MODEL_ENV_VARS = Object.freeze({
  research: "LLM_MODEL_RESEARCH",
  writer: "LLM_MODEL_BLOGGING",
  chip: "LLM_MODEL_CHIP",
  extraction: "LLM_MODEL_EXTRACTION",
  transcription: "LLM_MODEL_TRANSCRIPTION",
}) satisfies Readonly<Record<GrowthAgentModelPurpose, string>>;

function modelFromEnvironment(
  value: string | undefined,
  fallback: string
): string {
  const candidate = value?.trim();
  if (!candidate || candidate.length > 200 || /[\u0000-\u001f\u007f]/.test(candidate)) {
    return fallback;
  }
  return candidate;
}

/** Resolve model routing at call time so deploy-time environment overrides work. */
export function getGrowthAgentModels(
  environment: NodeJS.ProcessEnv = process.env
): GrowthAgentModels {
  return {
    research: modelFromEnvironment(
      environment[GROWTH_AGENT_MODEL_ENV_VARS.research],
      DEFAULT_GROWTH_AGENT_MODELS.research
    ),
    writer: modelFromEnvironment(
      environment[GROWTH_AGENT_MODEL_ENV_VARS.writer] ??
        environment.LLM_MODEL_WRITER ??
        environment.OPENAI_BLOG_WRITER_MODEL,
      DEFAULT_GROWTH_AGENT_MODELS.writer
    ),
    chip: modelFromEnvironment(
      environment[GROWTH_AGENT_MODEL_ENV_VARS.chip],
      DEFAULT_GROWTH_AGENT_MODELS.chip
    ),
    extraction: modelFromEnvironment(
      environment[GROWTH_AGENT_MODEL_ENV_VARS.extraction],
      DEFAULT_GROWTH_AGENT_MODELS.extraction
    ),
    transcription: modelFromEnvironment(
      environment[GROWTH_AGENT_MODEL_ENV_VARS.transcription],
      DEFAULT_GROWTH_AGENT_MODELS.transcription
    ),
  };
}

export function getGrowthAgentModel(
  purpose: GrowthAgentModelPurpose,
  environment: NodeJS.ProcessEnv = process.env
): string {
  return getGrowthAgentModels(environment)[purpose];
}
