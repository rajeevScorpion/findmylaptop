"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

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

    const supabase = createClient();
    const { error } = await supabase
      .from("laptops")
      .update({ feature_on_home: next })
      .eq("id", laptopId);

    if (error) {
      setFeatured(!next); // revert
    }
    setLoading(false);
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
