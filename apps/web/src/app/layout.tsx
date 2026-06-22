import type { Metadata, Viewport } from "next";
import { Doto, Plus_Jakarta_Sans, Outfit } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme-context";

const displayFont = Doto({
  variable: "--font-display",
  subsets: ["latin"],
});

const bodyFont = Doto({
  variable: "--font-body",
  subsets: ["latin"],
});

const dashBodyFont = Plus_Jakarta_Sans({
  variable: "--font-dash-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const dashDisplayFont = Outfit({
  variable: "--font-dash-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Create Project | AlphaCI",
  description:
    "Create GitHub projects with subscription-gated CI workflows, starter files, and managed Actions secrets.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body className={`${displayFont.variable} ${bodyFont.variable} ${dashBodyFont.variable} ${dashDisplayFont.variable} antialiased`} suppressHydrationWarning>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
