import type { Metadata } from "next";
import { headers } from "next/headers";

import RoastReport from "@/components/RoastReport";
import { auditVersionHash, getAuditReport, getCachedAuditReport } from "@/lib/audit";
import { consumeRateLimit } from "@/lib/cache";
import { toPublicAuditError } from "@/lib/public-errors";

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

    const headerStore = await headers();
    const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const rate = await consumeRateLimit(`rate:audit:page:${ip}`, 10, 60 * 60);

    if (!rate.allowed) {
      return (
        <RoastReport
          initialStage="intake"
          initialSubject={wallet}
          initialError="Rate limit exceeded."
        />
      );
    }

    const report = await getAuditReport(wallet);
    return <RoastReport initialStage="verdict" initialSubject={wallet} report={report} />;
  } catch (error) {
    return (
      <RoastReport
        initialStage="intake"
        initialSubject={wallet}
        initialError={toPublicAuditError(error)}
      />
    );
  }
}
