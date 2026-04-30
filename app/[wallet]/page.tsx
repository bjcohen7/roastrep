import type { Metadata } from "next";
import { notFound } from "next/navigation";

import RoastReport from "@/components/RoastReport";
import { getAuditReport } from "@/lib/audit";

type WalletPageProps = {
  params: Promise<{ wallet: string }>;
};

export async function generateMetadata({ params }: WalletPageProps): Promise<Metadata> {
  const { wallet } = await params;
  try {
    const report = await getAuditReport(wallet);
    const baseUrl = report.shareBaseUrl.startsWith("http") ? report.shareBaseUrl : `https://${report.shareBaseUrl}`;
    return {
      title: `The Roast Report — ${report.displayName}`,
      description: `${report.severityRating.grade}. ${report.severityRating.label}. Outlook ${report.severityRating.outlook}.`,
      openGraph: {
        title: `The Roast Report — ${report.displayName}`,
        description: `${report.severityRating.grade}. ${report.severityRating.label}. Outlook ${report.severityRating.outlook}.`,
        images: [`${baseUrl}/api/og/${encodeURIComponent(wallet)}`]
      },
      twitter: {
        card: "summary_large_image",
        title: `The Roast Report — ${report.displayName}`,
        description: `${report.severityRating.grade}. ${report.severityRating.label}. Outlook ${report.severityRating.outlook}.`,
        images: [`${baseUrl}/api/og/${encodeURIComponent(wallet)}`]
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
    const report = await getAuditReport(wallet);
    return <RoastReport initialStage="verdict" initialSubject={wallet} report={report} />;
  } catch {
    notFound();
  }
}
