import { describe, expect, it } from "vitest";
import { isSafeInternalBlogHref, safeInternalBlogHref } from "./links";

describe("blog CTA links", () => {
  it("allows bounded internal application paths", () => {
    expect(isSafeInternalBlogHref("/")).toBe(true);
    expect(isSafeInternalBlogHref("/blog/student-laptop-guide#checklist")).toBe(true);
    expect(isSafeInternalBlogHref("/design?highlight=example-laptop")).toBe(true);
  });

  it("rejects external, executable, protocol-relative, and backslash paths", () => {
    for (const href of [
      "https://example.com",
      "javascript:alert(1)",
      "data:text/html,unsafe",
      "//example.com/path",
      "/\\example.com/path",
      "/path with spaces",
    ]) {
      expect(isSafeInternalBlogHref(href)).toBe(false);
      expect(safeInternalBlogHref(href)).toBe("/");
    }
  });
});
