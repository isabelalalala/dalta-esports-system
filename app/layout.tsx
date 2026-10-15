import type { Metadata } from "next";
import { Geist, Geist_Mono, Press_Start_2P } from "next/font/google";
import "./globals.css";
import Footer from "@/components/Footer";
import SiteHeader from "@/components/site/SiteHeader";
import { SITE_URL } from "@/utils/site-url";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Pixel/retro font for the public website's headings (Tailwind class: font-pixel)
const pressStart = Press_Start_2P({
  variable: "--font-press-start",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Facebook needs full URLs for link previews (NEXT_PUBLIC_SITE_URL)
  metadataBase: new URL(SITE_URL),
  title: "DALTA Esports",
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
      className={`${geistSans.variable} ${geistMono.variable} ${pressStart.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* The same header on every page, logged in or not */}
        <SiteHeader />
        {children}
        <Footer />
      </body>
    </html>
  );
}
