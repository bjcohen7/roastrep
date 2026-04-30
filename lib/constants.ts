import type { SummaryMetric } from "@/lib/types";

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

export const SHARE_TEXT_VARIANTS = [
  (rating: string) => `my onchain conduct has been forensically audited

verdict: ${rating}
outlook: negative

submit your wallet`,
  (rating: string) => `the bureau of onchain affairs has reviewed my wallet and i regret asking

rating: ${rating}. catastrophic.

audit yours`,
  (rating: string) => `rated ${rating} by The Roast Report

they were not kind

your turn`,
  () => `imagine selling a Bored Ape for 4.82 ETH in 2021

couldn't be me

(it was me. they have the receipts.)`
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

export const DEFAULT_SHARE_BASE_URL = "theroastreport.xyz";

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
