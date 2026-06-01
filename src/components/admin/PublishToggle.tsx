"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { createClient } from "@/lib/supabase/client";

interface PublishToggleProps {
  laptopId: string;
  initialPublished: boolean;
}

export function PublishToggle({ laptopId, initialPublished }: PublishToggleProps) {
  const [published, setPublished] = useState(initialPublished);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    setLoading(true);
    const next = !published;
    setPublished(next); // optimistic

    const supabase = createClient();
    const { error } = await supabase
      .from("laptops")
      .update({ is_published: next })
      .eq("id", laptopId);

    if (error) {
      setPublished(!next); // revert
    }
    setLoading(false);
  };

  return (
    <Switch
      checked={published}
      onCheckedChange={toggle}
      disabled={loading}
      aria-label="Toggle publish"
    />
  );
}
