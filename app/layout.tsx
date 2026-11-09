import type { Metadata } from "next";
import "./globals.css";
import Footer from "@/components/Footer";
import Toaster from "@/components/Toaster";
import SiteHeader from "@/components/site/SiteHeader";
import { SITE_URL } from "@/utils/site-url";
import { montserrat } from "@/utils/fonts";
import { THEME_INIT_SCRIPT } from "@/utils/theme";

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
    // suppressHydrationWarning: the theme script sets data-theme on <html> before React loads
    <html
      lang="en"
      className={`${montserrat.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Runs before the page paints, so dark-mode users never see a white flash (utils/theme.ts) */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full w-full flex flex-col bg-white text-stone-950">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-gold focus:text-stone-950 focus:px-4 focus:py-2 focus:border-2 focus:border-brown focus:font-bold uppercase"
        >
          Skip to content
        </a>
        <SiteHeader />
        {children}
        <Footer />
        <Toaster />
      </body>
    </html>
  );
}
