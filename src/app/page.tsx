import type { Metadata } from "next";
import { HomeHub } from "@/components/public/HomeHub";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Find My Laptop — Laptops for Design, Tech & Management Students",
  description:
    "Pick your discipline and get laptop recommendations built for the work you actually do — design, technology, or management. Honest, jargon-free guidance for Indian students.",
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  return <HomeHub />;
}
