import type { DomainId } from "@/lib/domains";

// Chip is only useful inside a domain — its persona, cheat-sheet and catalog are
// all domain-scoped. On the discipline-agnostic pages (home hub, blog) the real
// widget is therefore replaced by ChipDomainRouter, which asks which discipline
// the visitor is in and navigates there.
//
// This carries the answer — and anything they had already typed — across the
// navigation, so the real widget opens on arrival with their question already
// sent, instead of dropping them onto a landing page with no trace of the
// conversation they just started.
//
// sessionStorage rather than a query param: it survives the client navigation,
// keeps the URL clean and canonical, and cannot be bookmarked or shared into a
// surprise auto-open. It also keeps the question out of the URL bar, browser
// history and any referrer header.
const CHIP_HANDOFF_KEY = "chip_handoff";

/** Matches the Textarea's maxLength on both ends of the handoff. */
const MAX_QUESTION_LENGTH = 2000;

export interface ChipHandoff {
  domain: DomainId;
  /** What they typed before choosing. Empty when they just picked a discipline. */
  question: string;
}

/** Called by the router immediately before it navigates to `domain`'s page. */
export function requestChipHandoff(domain: DomainId, question = ""): void {
  try {
    const payload: ChipHandoff = {
      domain,
      question: question.trim().slice(0, MAX_QUESTION_LENGTH),
    };
    sessionStorage.setItem(CHIP_HANDOFF_KEY, JSON.stringify(payload));
  } catch {}
}

/**
 * Returns the handoff exactly once, and only on the page it was meant for — a
 * pending Technology handoff never pops Chip open on Design.
 */
export function consumeChipHandoff(domain: DomainId): ChipHandoff | null {
  try {
    const raw = sessionStorage.getItem(CHIP_HANDOFF_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ChipHandoff> | null;
    if (parsed?.domain !== domain) return null;
    sessionStorage.removeItem(CHIP_HANDOFF_KEY);
    return {
      domain,
      question: typeof parsed.question === "string" ? parsed.question : "",
    };
  } catch {
    // A malformed entry must not wedge every future visit — drop it and move on.
    try {
      sessionStorage.removeItem(CHIP_HANDOFF_KEY);
    } catch {}
    return null;
  }
}
