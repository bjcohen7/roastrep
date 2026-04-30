import type { Metadata } from "next";

import RoastReport from "@/components/RoastReport";

export const metadata: Metadata = {
  title: "The Roast Report",
  description: "Enter a wallet or ENS name and receive a dry, overcapitalized forensic audit of its NFT behavior.",
  alternates: {
    canonical: "/"
  }
};

export default function HomePage() {
  return <RoastReport initialStage="intake" />;
}
