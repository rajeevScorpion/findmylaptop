// Decides whether a click should light up the top route-progress bar.
// Kept pure (no DOM types) so the rules are unit-testable.

export interface NavigationClickIntent {
  /** The anchor's raw `href` attribute — may be relative, a hash, or a scheme. */
  href: string | null | undefined;
  /** `window.location.href` at the moment of the click. */
  currentHref: string;
  /** The anchor's `target` attribute. */
  target?: string | null;
  /** Whether the anchor carries a `download` attribute. */
  download?: boolean;
}

/**
 * True only for clicks that produce an in-app route transition worth showing
 * progress for. Deliberately conservative: anything that leaves the app (new
 * tab, download, another origin, `mailto:`/`tel:`) already gets the browser's
 * own loading UI, and same-URL or hash-only clicks never re-render a route, so
 * a bar there would hang until the safety timeout.
 */
export function shouldTrackNavigation({
  href,
  currentHref,
  target,
  download = false,
}: NavigationClickIntent): boolean {
  if (!href || download) return false;
  if (target && target !== "_self") return false;

  let destination: URL;
  let current: URL;
  try {
    current = new URL(currentHref);
    destination = new URL(href, currentHref);
  } catch {
    return false;
  }

  if (destination.protocol !== "http:" && destination.protocol !== "https:") {
    return false;
  }
  if (destination.origin !== current.origin) return false;

  // Same page (or just a different hash): the router does not fetch anything.
  if (
    destination.pathname === current.pathname &&
    destination.search === current.search
  ) {
    return false;
  }

  return true;
}
