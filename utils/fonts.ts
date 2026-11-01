import { Montserrat } from "next/font/google";

// Montserrat for all typography. Shared by app/layout.tsx and app/global-error.tsx
// (both render their own <html>). The CSS variable is named --font-montserrat-next so it
// never clashes with the --font-montserrat theme token in app/globals.css: a theme token
// that pointed at a variable with its own name made the font invalid (browser serif fallback).
export const montserrat = Montserrat({
  variable: "--font-montserrat-next",
  weight: ["400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
  display: "swap",
});
