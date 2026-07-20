import { describe, expect, it } from "vitest";
import { serializeJsonLd } from "./json-ld";

describe("JSON-LD serialization", () => {
  it("escapes script terminators and JavaScript separator characters", () => {
    const serialized = serializeJsonLd({
      text: "</script><script>alert(1)</script>&\u2028\u2029",
    });

    expect(serialized).not.toContain("<");
    expect(serialized).not.toContain(">");
    expect(serialized).not.toContain("&");
    expect(serialized).toContain("\\u003c/script\\u003e");
    expect(serialized).toContain("\\u2028");
    expect(serialized).toContain("\\u2029");
  });
});
