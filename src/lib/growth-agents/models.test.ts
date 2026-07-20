import { describe, expect, it } from "vitest";
import {
  DEFAULT_GROWTH_AGENT_MODELS,
  getGrowthAgentModel,
  getGrowthAgentModels,
} from "./models";

describe("growth-agent model routing", () => {
  it("uses the researched task-specific defaults", () => {
    const environment = { NODE_ENV: "test" } as NodeJS.ProcessEnv;
    expect(getGrowthAgentModels(environment)).toEqual(DEFAULT_GROWTH_AGENT_MODELS);
    expect(getGrowthAgentModel("research", environment)).toBe("gpt-5.6-terra");
    expect(getGrowthAgentModel("writer", environment)).toBe("gpt-5.6-luna");
    expect(getGrowthAgentModel("chip", environment)).toBe("gpt-5.6-luna");
    expect(getGrowthAgentModel("extraction", environment)).toBe("gpt-5.6-luna");
    expect(getGrowthAgentModel("transcription", environment)).toBe(
      "gpt-4o-mini-transcribe"
    );
  });

  it("accepts bounded server-side overrides and rejects malformed values", () => {
    const environment = {
      NODE_ENV: "test",
      LLM_MODEL_RESEARCH: " researched-model ",
      LLM_MODEL_BLOGGING: "writer-model",
      LLM_MODEL_CHIP: "bad\nmodel",
      LLM_MODEL_EXTRACTION: "x".repeat(201),
      LLM_MODEL_TRANSCRIPTION: "transcription-model",
    } as NodeJS.ProcessEnv;

    expect(getGrowthAgentModels(environment)).toEqual({
      research: "researched-model",
      writer: "writer-model",
      chip: DEFAULT_GROWTH_AGENT_MODELS.chip,
      extraction: DEFAULT_GROWTH_AGENT_MODELS.extraction,
      transcription: "transcription-model",
    });
  });
});
