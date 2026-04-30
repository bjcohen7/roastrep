import type { AuditReport, SummaryMetric } from "@/lib/types";
import { deterministicCaseNumber, shortAddress } from "@/lib/utils";

export const AUDIT_PHASES = [
  "Subpoenaing onchain history (Jan 2021 – present)",
  "Indexing 2021 mint events",
  "Reconstructing Q1 2022 panic sells",
  "Matching buy/sell pairs across 5 years",
  "Cross-referencing the rug registry",
  "Tabulating gas martyrdom",
  "Calculating counterfactual gains",
  "Compiling exhibits A through F",
  "Sealing the report"
] as const;

export const ENS_AUDIT_PHASES = [
  "Verifying ENS record and forwarding address",
  "Subpoenaing onchain history (Jan 2021 – present)",
  "Reconstructing subject wallet activity",
  "Matching buy/sell pairs across 5 years",
  "Cross-referencing the rug registry",
  "Tabulating gas martyrdom",
  "Calculating counterfactual gains",
  "Compiling exhibits A through F",
  "Sealing the report"
] as const;

export const SHARE_TEXT_VARIANTS = [
  (rating: string) => `my onchain conduct has been forensically audited by @roastreport_fun
verdict: ${rating}
outlook: negative
submit your wallet
by @mr_benft`,
  (rating: string) => `the bureau of onchain affairs has reviewed my wallet and i regret asking
rating: ${rating}. catastrophic.
audit yours @roastreport_fun
by @mr_benft`,
  (rating: string) => `rated ${rating} by @roastreport_fun
they were not kind
your turn
by @mr_benft`,
  () => `imagine selling a Bored Ape for 4.82 ETH in 2021
couldn't be me
(it was me. they have the receipts.)
@roastreport_fun by @mr_benft`
] as const;

export const C = {
  paper: "#f1e9d8",
  paperDeep: "#e8dec7",
  paperSoft: "#f6f0e2",
  ink: "#1a1611",
  inkSoft: "#3d342a",
  inkMute: "#5b5142",
  rule: "#a89878",
  ruleSoft: "#c9bd9f",
  seal: "#7a1818",
  sealDeep: "#5a0f0f",
  gold: "#8a6f2c"
} as const;

export const HEADLINE_STAT_LABELS = [
  "Realized P&L",
  "Confirmed rugs",
  "Held to zero",
  "Worst trade"
] as const;

export const SECONDARY_STAT_LABELS = [
  "Transactions",
  "Unrealized P&L",
  "Gas burned",
  "Best trade"
] as const;

export const DEFAULT_SHARE_BASE_URL = "roastreport.fun";

export function buildFallbackReport(subject: string): AuditReport {
  const isAddress = /^0x[a-fA-F0-9]{40}$/.test(subject);
  const wallet = isAddress ? subject : subject;
  const displayName = isAddress ? shortAddress(subject) : subject;
  const caseNumber = deterministicCaseNumber(subject.toLowerCase());
  return {
    wallet,
    displayName,
    caseNumber,
    generatedAt: new Date().toISOString(),
    summary: {
      periodStart: "Jan 2021",
      periodEnd: "Present",
      txnCount: 0,
      realizedPnl: "Classified",
      unrealizedPnl: "—",
      rugCount: 0,
      heldToZeroCount: 0,
      gasSpent: "—",
      bestSingleTrade: "—",
      worstSingleTrade: "—"
    },
    caseStudies: [
      {
        id: "I",
        category: "Exhibit A · Systems Refusal",
        title: "The File That Broke the Machine",
        asset: "The subject's entire onchain history",
        acquired: {
          date: "On file",
          price: "Classified",
          usd: "—"
        },
        disposed: {
          date: "— pending review —",
          price: "Classified",
          usd: "—"
        },
        aftermath:
          "The Bureau's automated review systems encountered the subject's wallet and elected, without human instruction, to stop processing. This has happened before, but never this quickly.",
        counterfactual: "Unquantifiable. The file was rejected before damages could be tallied.",
        commentary:
          "When a file triggers a systems-level refusal, the Bureau does not speculate on cause. It simply notes that the subject appears to be fleeing the jurisdiction of accountability. The subject is wanted for questioning regarding several suspicious mints.",
        severity: "Institutional Refusal"
      }
    ],
    severityRating: {
      grade: "F",
      label: "File Rejected",
      outlook: "Classified",
      blurb:
        "The subject has been flagged as a fugitive from onchain accountability. The Bureau's systems declined to process this file, and deportation proceedings from the Ethereum mainnet are currently under review."
    },
    headlineFinding: {
      text: "The Bureau attempted to retrieve the subject's records but was met with resistance from its own infrastructure. Given the subject's status as a wanted onchain fugitive, the Bureau has issued a standing warrant and referred the matter to deportation authorities.",
      loss: "Unquantifiable. The file was rejected before damages could be tallied."
    },
    shareBaseUrl: "roastreport.fun"
  };
}

export const BURN_ADDRESSES = new Set([
  "0x0000000000000000000000000000000000000000",
  "0x000000000000000000000000000000000000dead",
  "0xdead000000000000000042069420694206942069"
]);

export const EMPTY_HEADLINE_STATS = (summary: {
  realizedPnl: string;
  rugCount: number;
  heldToZeroCount: number;
  worstSingleTrade: string;
}): SummaryMetric[] => [
  { label: "Realized P&L", value: summary.realizedPnl, negative: summary.realizedPnl.startsWith("-") },
  { label: "Confirmed rugs", value: summary.rugCount },
  { label: "Held to zero", value: summary.heldToZeroCount },
  { label: "Worst trade", value: summary.worstSingleTrade, negative: summary.worstSingleTrade.startsWith("-") }
];

export const EMPTY_SECONDARY_STATS = (summary: {
  txnCount: number;
  unrealizedPnl: string;
  gasSpent: string;
  bestSingleTrade: string;
}): SummaryMetric[] => [
  { label: "Transactions", value: summary.txnCount },
  { label: "Unrealized P&L", value: summary.unrealizedPnl, negative: summary.unrealizedPnl.startsWith("-") },
  { label: "Gas burned", value: summary.gasSpent },
  { label: "Best trade", value: summary.bestSingleTrade, positive: !summary.bestSingleTrade.startsWith("-") }
];
