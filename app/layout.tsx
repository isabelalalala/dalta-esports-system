import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import Footer from "@/components/Footer";
import SiteHeader from "@/components/site/SiteHeader";
import { SITE_URL } from "@/utils/site-url";

// Uppercase Montserrat font for all typography across the layout
const montserrat = Montserrat({
  variable: "--font-montserrat",
  weight: ["400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
  display: "swap",
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
    images: [{ url: "/DALTA ESPORTS LOGO TRNPRNT.png", width: 1080, height: 1080, alt: "DALTA Esports logo" }],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${montserrat.variable} h-full antialiased`}
    >
      <body className="min-h-full w-full flex flex-col bg-white text-sitebg uppercase">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-gold focus:text-sitebg focus:px-4 focus:py-2 focus:border-2 focus:border-brown focus:font-bold uppercase"
        >
          Skip to content
        </a>
        <SiteHeader />
        {children}
        <Footer />
      </body>
    </html>
  );
}
