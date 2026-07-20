"use client";

import { useState } from "react";
import { Star } from "lucide-react";

interface FeatureToggleProps {
  laptopId: string;
  initialFeatured: boolean;
}

// Toggles `feature_on_home` — whether a laptop shows in the hub's Editor's Picks.
// Same optimistic client-update pattern as PublishToggle / InlinePriceEdit.
export function FeatureToggle({ laptopId, initialFeatured }: FeatureToggleProps) {
  const [featured, setFeatured] = useState(initialFeatured);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    setLoading(true);
    const next = !featured;
    setFeatured(next); // optimistic

    try {
      const response = await fetch("/api/admin/laptops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_featured", laptopId, value: next }),
      });
      if (!response.ok) setFeatured(!next);
    } catch {
      setFeatured(!next); // revert
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      aria-label={featured ? "Remove from Editor's Picks" : "Add to Editor's Picks"}
      aria-pressed={featured}
      title={featured ? "Featured on home" : "Not featured"}
      className="inline-flex items-center justify-center w-7 h-7 rounded-lg hover:bg-muted transition-colors disabled:opacity-40"
    >
      <Star
        className={
          featured
            ? "w-4 h-4 fill-amber-400 text-amber-400"
            : "w-4 h-4 text-muted-foreground"
        }
      />
    </button>
  );
}
