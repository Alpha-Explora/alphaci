import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Plus_Jakarta_Sans, Outfit } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/shared/layout/theme-context";

const displayFont = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const bodyFont = Space_Grotesk({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
  title: {
    default: "ALPHACI CI/CD Platform",
    template: "%s | ALPHACI CI/CD Platform",
  },
  description:
    "Internal employee workspace for provisioning GitHub projects with governed CI/CD workflows, starter files, and managed Actions secrets.",
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
      <body
        className={`${displayFont.variable} ${bodyFont.variable} ${dashBodyFont.variable} ${dashDisplayFont.variable} antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
