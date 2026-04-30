import type { Metadata } from "next";

import { fraunces, instrumentSerif, jetbrainsMono } from "@/lib/fonts";

import "./globals.css";

export const metadata: Metadata = {
  title: "The Roast Report",
  description: "Forensic audit of onchain conduct.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
