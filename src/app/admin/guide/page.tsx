import type { Metadata } from "next";
import { AdminGuideExplorer } from "@/components/admin/guide/AdminGuideExplorer";

export const metadata: Metadata = {
  title: "Admin Operations Guide | LaptopFinder",
  description: "Step-by-step operating and extension guide for the LaptopFinder admin platform.",
};

export default function AdminGuidePage() {
  return <AdminGuideExplorer />;
}
