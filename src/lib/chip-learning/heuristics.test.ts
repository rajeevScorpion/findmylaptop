import { describe, expect, it } from "vitest";

import {
  extractChipConversationPreferences,
  extractChipPreferences,
  hasChipPreferenceSignals,
} from "./heuristics";

describe("Chip preference heuristics", () => {
  it("extracts bounded laptop-fit preferences without retaining text", () => {
    const result = extractChipPreferences(
      "I'm a fashion design student using CLO 3D and Illustrator. My budget is INR 70K-INR 1L; I prefer Lenovo, avoid HP, and need a lightweight laptop with good battery.",
      "design"
    );

    expect(result.budgetMin).toBe(70_000);
    expect(result.budgetMax).toBe(100_000);
    expect(result.roleTags).toEqual(["student"]);
    expect(result.courseTags).toContain("fashion-design");
    expect(result.softwareTags).toEqual(
      expect.arrayContaining(["clo-3d", "illustrator"])
    );
    expect(result.brandPreferences).toEqual(
      expect.arrayContaining(["prefer:lenovo", "avoid:hp"])
    );
    expect(result.priorityTags).toEqual(
      expect.arrayContaining(["portability", "battery-life"])
    );
    expect(result).not.toHaveProperty("input");
    expect(result).not.toHaveProperty("summary");
  });

  it("does not mistake ordinary RAM and SSD numbers for a budget", () => {
    const result = extractChipPreferences(
      "I need 16GB RAM and 512GB SSD for Docker and VS Code.",
      "technology"
    );

    expect(result.budgetMin).toBeNull();
    expect(result.budgetMax).toBeNull();
    expect(result.softwareTags).toEqual(["docker", "vs-code"]);
  });

  it("understands an Indian lakh budget ceiling", () => {
    const result = extractChipPreferences(
      "Please suggest something under 1.5 lakh for Power BI.",
      "management"
    );

    expect(result.budgetMin).toBeNull();
    expect(result.budgetMax).toBe(150_000);
    expect(result.softwareTags).toContain("power-bi");
  });

  it("ignores identity and contact text when no recommendation signal exists", () => {
    const result = extractChipPreferences(
      "My name is Example Person, email me at person@example.com or call 9999999999.",
      "design"
    );

    expect(hasChipPreferenceSignals(result)).toBe(false);
    expect(result.confidence).toBe(0);
  });

  it("is deterministic for the same inputs", () => {
    const input = [
      "MBA student",
      "Need Excel and Power BI",
      "Budget up to INR 90000",
    ];

    expect(extractChipPreferences(input, "management")).toEqual(
      extractChipPreferences(input, "management")
    );
  });

  it("lets the latest conversation budget and brand choice win", () => {
    const result = extractChipConversationPreferences(
      [
        "My budget is 70k and I prefer HP.",
        "I can stretch to 1 lakh now, and I want to avoid HP.",
      ],
      "design"
    );

    expect(result.budgetMax).toBe(100_000);
    expect(result.brandPreferences).toContain("avoid:hp");
    expect(result.brandPreferences).not.toContain("prefer:hp");
  });
});
