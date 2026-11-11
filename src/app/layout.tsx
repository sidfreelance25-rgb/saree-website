import type { Metadata, Viewport } from "next";
import { Fraunces, Outfit } from "next/font/google";
import { SwRegister } from "@/components/widgets";
import "./globals.css";

const display = Fraunces({ subsets: ["latin"], variable: "--font-display" });
const sans = Outfit({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: { default: "Taana", template: "%s · Taana" },
  description: "A multi-store commerce platform for independent saree houses.",
  applicationName: "Taana",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Taana", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#6E2433",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${sans.variable}`}>
        <SwRegister />
        {children}
      </body>
    </html>
  );
}
