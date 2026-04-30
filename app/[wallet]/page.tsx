import type { Metadata } from "next";

import RoastReport from "@/components/RoastReport";
import { auditVersionHash, getCachedAuditReport } from "@/lib/audit";

type WalletPageProps = {
  params: Promise<{ wallet: string }>;
};

export async function generateMetadata({ params }: WalletPageProps): Promise<Metadata> {
  const { wallet } = await params;
  try {
    const report = await getCachedAuditReport(wallet);
    if (!report) {
      return {
        title: `The Roast Report — ${wallet}`
      };
    }
    const baseUrl = report.shareBaseUrl.startsWith("http") ? report.shareBaseUrl : `https://${report.shareBaseUrl}`;
    const canonicalPath = `/${encodeURIComponent(wallet)}`;
    const ogImageUrl = `${baseUrl}/api/og/${encodeURIComponent(wallet)}?v=${auditVersionHash(report)}`;
    const description = `${report.severityRating.grade}. ${report.severityRating.label}. Outlook ${report.severityRating.outlook}.`;
    const title = `The Roast Report — ${report.displayName}`;
    const imageAlt = `Roast Report card for ${report.displayName}: ${report.severityRating.grade}, ${report.severityRating.label}, outlook ${report.severityRating.outlook}.`;
    return {
      title,
      description,
      alternates: {
        canonical: canonicalPath
      },
      openGraph: {
        type: "website",
        url: `${baseUrl}${canonicalPath}`,
        siteName: "The Roast Report",
        title,
        description,
        images: [
          {
            url: ogImageUrl,
            width: 1200,
            height: 630,
            alt: imageAlt
          }
        ]
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [ogImageUrl]
      },
      other: {
        "twitter:image:alt": imageAlt
      }
    };
  } catch {
    return {
      title: `The Roast Report — ${wallet}`
    };
  }
}

export default async function WalletPage({ params }: WalletPageProps) {
  const { wallet } = await params;
  try {
    const cached = await getCachedAuditReport(wallet);
    if (cached) {
      return <RoastReport initialStage="verdict" initialSubject={wallet} report={cached} />;
    }

    // No cached report available — render the analyzing UI and let the client-side
    // fetch handle the audit via the API route (which has proper timeout handling).
    return <RoastReport initialStage="analyzing" initialSubject={wallet} />;
  } catch {
    // If cache lookup itself fails, fall back to client-side fetch.
    return <RoastReport initialStage="analyzing" initialSubject={wallet} />;
  }
}
