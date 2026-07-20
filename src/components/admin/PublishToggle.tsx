"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";

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

    try {
      const response = await fetch("/api/admin/laptops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_published", laptopId, value: next }),
      });
      if (!response.ok) setPublished(!next);
    } catch {
      setPublished(!next); // revert
    } finally {
      setLoading(false);
    }
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
