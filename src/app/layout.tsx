import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://laptopfinder.cc"
  ),
  title: "Find My Laptop — Design Course Laptop Recommender",
  description:
    "Find the perfect laptop for your design course. Get personalised recommendations based on your discipline, budget, and creative workflow.",
  openGraph: {
    title: "Find My Laptop — Design Course Laptop Recommender",
    description:
      "Personalised laptop recommendations for design students. Filter by course, budget, and workload.",
    type: "website",
    images: [
      {
        url: "/sharing-cover.png",
        width: 1200,
        height: 630,
        alt: "Find My Laptop — Design Course Laptop Recommender",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Find My Laptop — Design Course Laptop Recommender",
    description:
      "Personalised laptop recommendations for design students. Filter by course, budget, and workload.",
    images: ["/sharing-cover.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
