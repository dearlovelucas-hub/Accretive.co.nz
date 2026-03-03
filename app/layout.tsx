import type { Metadata } from "next";
import { Cormorant_Garamond } from "next/font/google";
import "./globals.css";
import AppChrome from "@/components/AppChrome";

const primarySerif = Cormorant_Garamond({ subsets: ["latin"], variable: "--font-primary", weight: ["400", "500", "600", "700"] });
const wordmarkSerif = Cormorant_Garamond({ subsets: ["latin"], variable: "--font-wordmark", weight: ["600"] });

export const metadata: Metadata = {
  title: "Accretive",
  description: "Accretive legal drafting software"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${primarySerif.variable} ${wordmarkSerif.variable}`}>
      <body className="font-[var(--font-primary)] antialiased">
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
