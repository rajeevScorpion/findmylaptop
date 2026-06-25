"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function LaptopRedirect({ slug, domain }: { slug: string; domain: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/${domain}?highlight=${slug}`);
  }, [slug, domain, router]);
  return null;
}
