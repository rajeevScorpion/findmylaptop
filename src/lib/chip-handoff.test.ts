import { beforeEach, describe, expect, it, vi } from "vitest";

import { consumeChipHandoff, requestChipHandoff } from "./chip-handoff";

// The module talks to sessionStorage directly (it only ever runs in the
// browser), so the node test environment needs one.
function installSessionStorage(): Storage {
  const store = new Map<string, string>();
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
  vi.stubGlobal("sessionStorage", storage);
  return storage;
}

describe("Chip domain handoff", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = installSessionStorage();
  });

  it("carries the typed question to the chosen domain", () => {
    requestChipHandoff("technology", "  which laptop runs docker well?  ");

    expect(consumeChipHandoff("technology")).toEqual({
      domain: "technology",
      question: "which laptop runs docker well?",
    });
  });

  it("hands off with no question when they only picked a discipline", () => {
    requestChipHandoff("design");

    expect(consumeChipHandoff("design")).toEqual({ domain: "design", question: "" });
  });

  it("only fires on the domain it was meant for", () => {
    requestChipHandoff("technology", "docker?");

    expect(consumeChipHandoff("design")).toBeNull();
    // Still pending — a visitor who lands on Design first can reach it later.
    expect(consumeChipHandoff("technology")?.question).toBe("docker?");
  });

  it("fires exactly once, so a later visit does not re-send", () => {
    requestChipHandoff("management", "best laptop for an MBA?");

    expect(consumeChipHandoff("management")).not.toBeNull();
    expect(consumeChipHandoff("management")).toBeNull();
  });

  it("drops a malformed entry instead of wedging every future visit", () => {
    storage.setItem("chip_handoff", "{not json");

    expect(consumeChipHandoff("design")).toBeNull();
    expect(storage.getItem("chip_handoff")).toBeNull();
  });

  it("caps the question at the length the input accepts", () => {
    requestChipHandoff("design", "a".repeat(5000));

    expect(consumeChipHandoff("design")?.question).toHaveLength(2000);
  });

  it("survives storage being unavailable", () => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    } as unknown as Storage);

    expect(() => requestChipHandoff("design", "hello")).not.toThrow();
    expect(consumeChipHandoff("design")).toBeNull();
  });
});
