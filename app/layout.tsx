import type { Metadata } from "next";

import { fraunces, instrumentSerif, jetbrainsMono } from "@/lib/fonts";
import { getEnv } from "@/lib/env";

import "./globals.css";

const siteUrl = getEnv("NEXT_PUBLIC_SITE_URL", "https://roastreport.fun") ?? "https://roastreport.fun";
const metadataBase = new URL(siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`);

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: "The Roast Report",
    template: "%s"
  },
  description: "A forensic audit of onchain conduct, written with institutional disappointment.",
  applicationName: "The Roast Report",
  alternates: {
    canonical: "/"
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "The Roast Report",
    title: "The Roast Report",
    description: "Submit a wallet. Receive a faux-serious forensic audit of their NFT behavior.",
    images: [
      {
        url: "/api/og",
        width: 1200,
        height: 630,
        alt: "The Roast Report share card"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "The Roast Report",
    description: "Submit a wallet. Receive a faux-serious forensic audit of their NFT behavior.",
    images: ["/api/og"]
  },
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg"
  },
  robots: {
    index: true,
    follow: true
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
