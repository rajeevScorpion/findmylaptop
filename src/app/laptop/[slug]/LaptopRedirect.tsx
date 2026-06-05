"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function LaptopRedirect({ slug }: { slug: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/?highlight=${slug}`);
  }, [slug, router]);
  return null;
}
