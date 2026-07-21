import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ADMIN_GUIDE_VERSION,
  ADMIN_SCREEN_GUIDES,
  CURRENT_OPERATIONAL_BOUNDARIES,
  WORKFLOW_GUIDES,
} from "./content";

describe("admin operations guide content", () => {
  it("covers every top-level admin screen with unique routes and anchors", () => {
    expect(ADMIN_SCREEN_GUIDES).toHaveLength(12);

    const ids = ADMIN_SCREEN_GUIDES.map((screen) => screen.id);
    const routes = ADMIN_SCREEN_GUIDES.map((screen) => screen.route);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(routes).size).toBe(routes.length);
    expect(routes.every((route) => route.startsWith("/admin"))).toBe(true);
  });

  it("gives operators and power users actionable material for every screen", () => {
    for (const screen of ADMIN_SCREEN_GUIDES) {
      expect(screen.purpose.length).toBeGreaterThan(20);
      expect(screen.prerequisites.length).toBeGreaterThan(0);
      expect(screen.steps.length).toBeGreaterThanOrEqual(4);
      expect(screen.outputs.length).toBeGreaterThan(0);
      expect(screen.relationships.length).toBeGreaterThanOrEqual(2);
      expect(screen.troubleshooting.length).toBeGreaterThan(0);
      expect(screen.powerUser.decisionPoints.length).toBeGreaterThan(0);
      expect(screen.powerUser.technicalPaths.length).toBeGreaterThan(0);
    }
  });

  it("keeps diagrams bounded, linked, and mobile-stackable", () => {
    for (const workflow of WORKFLOW_GUIDES) {
      expect(workflow.nodes.length).toBeGreaterThanOrEqual(3);
      expect(workflow.nodes.length).toBeLessThanOrEqual(8);
      expect(workflow.nodes.every((node) => node.href.startsWith("/admin"))).toBe(true);
      expect(workflow.completion.length).toBeGreaterThan(20);
    }
  });

  it("documents the current control and research boundaries", () => {
    const boundaries = JSON.stringify(CURRENT_OPERATIONAL_BOUNDARIES);
    expect(boundaries).toContain("Research Queue");
    expect(boundaries).toContain("Research Calendar");
    expect(boundaries).toContain("do not stop");
    expect(boundaries).toContain("persists the scrubbed result");
    expect(boundaries).toContain("only when validation succeeds");
  });

  it("keeps the Markdown handbook aligned with guide version and routes", () => {
    const handbook = readFileSync(
      join(process.cwd(), "docs", "ADMIN_OPERATIONS_GUIDE.md"),
      "utf8"
    );

    expect(handbook).toContain(`Version: **${ADMIN_GUIDE_VERSION}**`);
    for (const screen of ADMIN_SCREEN_GUIDES) {
      expect(handbook).toContain(screen.route);
    }
  });
});
