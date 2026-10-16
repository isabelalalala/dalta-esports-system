import type { Metadata } from "next";
import { Press_Start_2P } from "next/font/google";
import "./globals.css";
import Footer from "@/components/Footer";
import SiteHeader from "@/components/site/SiteHeader";
import { SITE_URL } from "@/utils/site-url";

// Pixel/retro font for the public website's headings (Tailwind class: font-pixel)
const pressStart = Press_Start_2P({
  variable: "--font-press-start",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Facebook needs full URLs for link previews (NEXT_PUBLIC_SITE_URL)
  metadataBase: new URL(SITE_URL),
  title: { default: "DALTA Esports", template: "%s – DALTA Esports" },
  description: "DALTA Esports: Tournament Management System",
  // Default preview for pages without their own (tournament and match pages generate one)
  openGraph: {
    siteName: "DALTA Esports",
    type: "website",
    images: [{ url: "/daltaesportslogo.jpg", width: 1080, height: 1080, alt: "DALTA Esports logo" }],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${pressStart.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-gold focus:text-sitebg focus:px-4 focus:py-2 focus:rounded focus:font-bold"
        >
          Skip to content
        </a>
        {/* The same header on every page, logged in or not */}
        <SiteHeader />
        {children}
        <Footer />
      </body>
    </html>
  );
}
