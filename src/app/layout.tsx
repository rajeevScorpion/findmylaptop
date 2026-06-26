import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Caveat } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Analytics } from "@vercel/analytics/next";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const caveat = Caveat({
  variable: "--font-handwriting",
  subsets: ["latin"],
});

// `resizes-content` shrinks the layout viewport when the on-screen keyboard
// opens (instead of the default `resizes-visual`, which overlays it). This lets
// `position: fixed` UI — notably the Chip chat window — sit above the keyboard
// on mobile instead of being covered by it.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
};

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
      className={`${geistSans.variable} ${geistMono.variable} ${caveat.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <meta name="impact-site-verification" {...{ value: "2280a2f3-f462-4e2f-b220-dd5c0ebddfb9" } as any} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Suspense>
          <ThemeProvider>{children}</ThemeProvider>
        </Suspense>
        <Analytics />
      </body>
    </html>
  );
}
