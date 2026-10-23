import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { seo, SITE_URL } from "@/content/site";
import "@/styles.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: seo.title, template: "%s · OpsBrain AI" },
  description: seo.description,
  applicationName: "OpsBrain AI",
  alternates: { canonical: "/" },
  openGraph: { title: seo.title, description: seo.description, url: "/", siteName: "OpsBrain AI", locale: "en_IN", type: "website" },
  twitter: { card: "summary_large_image", title: seo.title, description: seo.description },
  robots: { index: true, follow: true },
  icons: { icon: "/brand/mark.png", apple: "/brand/mark.png" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#ffffff" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={inter.variable}><body>{children}</body></html>;
}