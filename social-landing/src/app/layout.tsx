import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { brand, seo, SITE_URL } from "@/content/site";
import { ThemeProvider } from "@/components/ThemeProvider";
import { themeInitializationScript } from "@/lib/theme";
import "@/styles.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: seo.title, template: `%s · ${brand.name}` },
  description: seo.description,
  applicationName: brand.name,
  alternates: { canonical: "/" },
  openGraph: { title: seo.title, description: seo.description, url: "/", siteName: brand.name, locale: "en_IN", type: "website" },
  twitter: { card: "summary_large_image", title: seo.title, description: seo.description },
  robots: { index: true, follow: true },
  icons: { icon: "/brand/earnedvoice-mark.svg", apple: "/brand/earnedvoice-mark.svg" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: [{ media: "(prefers-color-scheme: light)", color: "#fffaf5" }, { media: "(prefers-color-scheme: dark)", color: "#181411" }] };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={inter.variable} suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: themeInitializationScript }} /></head><body><ThemeProvider>{children}</ThemeProvider></body></html>;
}