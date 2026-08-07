import { describe, expect, it } from "vitest";
import { shouldTrackNavigation } from "./navigation-progress";

const CURRENT = "https://laptopfinder.cc/blog?q=ram";

describe("shouldTrackNavigation", () => {
  it("tracks a same-origin route change", () => {
    expect(
      shouldTrackNavigation({ href: "/blog/power-bi-laptops", currentHref: CURRENT })
    ).toBe(true);
  });

  it("tracks an absolute same-origin URL", () => {
    expect(
      shouldTrackNavigation({
        href: "https://laptopfinder.cc/design",
        currentHref: CURRENT,
      })
    ).toBe(true);
  });

  it("tracks a search-param-only change on the same path", () => {
    expect(
      shouldTrackNavigation({ href: "/blog?q=gpu", currentHref: CURRENT })
    ).toBe(true);
  });

  it("ignores the current URL and hash-only links", () => {
    expect(shouldTrackNavigation({ href: "/blog?q=ram", currentHref: CURRENT })).toBe(
      false
    );
    expect(shouldTrackNavigation({ href: "#toc", currentHref: CURRENT })).toBe(false);
  });

  it("ignores other origins", () => {
    expect(
      shouldTrackNavigation({ href: "https://amazon.in/dp/X", currentHref: CURRENT })
    ).toBe(false);
  });

  it("ignores non-http schemes", () => {
    expect(
      shouldTrackNavigation({ href: "mailto:hi@laptopfinder.cc", currentHref: CURRENT })
    ).toBe(false);
    expect(shouldTrackNavigation({ href: "tel:+911234567890", currentHref: CURRENT })).toBe(
      false
    );
  });

  it("ignores links that open a new tab or download", () => {
    expect(
      shouldTrackNavigation({ href: "/api/out/123", currentHref: CURRENT, target: "_blank" })
    ).toBe(false);
    expect(
      shouldTrackNavigation({ href: "/report.pdf", currentHref: CURRENT, download: true })
    ).toBe(false);
  });

  it("still tracks an explicit _self target", () => {
    expect(
      shouldTrackNavigation({ href: "/technology", currentHref: CURRENT, target: "_self" })
    ).toBe(true);
  });

  it("ignores missing or unparseable hrefs", () => {
    expect(shouldTrackNavigation({ href: null, currentHref: CURRENT })).toBe(false);
    expect(shouldTrackNavigation({ href: "", currentHref: CURRENT })).toBe(false);
    expect(shouldTrackNavigation({ href: "http://", currentHref: CURRENT })).toBe(false);
  });
});
