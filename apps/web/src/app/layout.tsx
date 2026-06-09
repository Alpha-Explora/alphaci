import type { Metadata } from "next";
import { Doto } from "next/font/google";
import "./globals.css";

const displayFont = Doto({
  variable: "--font-display",
  subsets: ["latin"],
});

const bodyFont = Doto({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Create Project | FlowCI Studio",
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
    <html lang="en" suppressHydrationWarning>
      <body className={`${displayFont.variable} ${bodyFont.variable} antialiased`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
