import { DEFAULT_SHARE_BASE_URL } from "@/lib/constants";
import { getEnv } from "@/lib/env";
import { getCachedJson, setCachedJson } from "@/lib/cache";
import { fetchAlchemyCollections, fetchAlchemyHoldings, fetchAlchemyTrades, fetchAlchemyTransferActivityCount } from "@/lib/alchemy";
import { generateCommentary } from "@/lib/claude";
import { resolveWalletOrEns } from "@/lib/ens";
import { fetchGasSummary } from "@/lib/etherscan";
import { buildFindings, defaultCaseStudies } from "@/lib/findings";
import { fetchCollectionFloorEvents, fetchCollections, fetchUserHoldings, fetchWalletTrades } from "@/lib/reservoir";
import type { AuditReport, CaseStudy, CollectionSnapshot, Holding, NormalizedTrade } from "@/lib/types";
import { deterministicCaseNumber, formatUsd, shortAddress, sha1 } from "@/lib/utils";

const AUDIT_TTL_SECONDS = 60 * 60 * 24;
const AUDIT_SCHEMA_VERSION = "2026-04-30-activity-fallback";

export async function getAuditReport(subject: string, options?: { refresh?: boolean }) {
  const resolved = await resolveWalletOrEns(subject);
  const cacheKey = `audit:${AUDIT_SCHEMA_VERSION}:${resolved.address.toLowerCase()}`;
  const preferAlchemy = Boolean(getEnv("ALCHEMY_API_KEY"));

  if (!options?.refresh) {
    const cached = await getCachedJson<AuditReport>(cacheKey);
    if (cached) return cached;
  }

  let trades: NormalizedTrade[] = [];
  let holdings: Holding[] = [];
  let collections: Map<string, CollectionSnapshot> = new Map();
  const floorHistory = new Map<string, Awaited<ReturnType<typeof fetchCollectionFloorEvents>>>();
  let activityCountOverride = 0;

  try {
    if (preferAlchemy) {
      trades = await fetchAlchemyTrades(resolved.address);
      holdings = await fetchAlchemyHoldings(resolved.address);
      if (trades.length === 0) {
        activityCountOverride = await fetchAlchemyTransferActivityCount(resolved.address).catch(() => 0);
      }
      const collectionIds = [
        ...trades.map((trade) => trade.collectionId),
        ...holdings.map((holding) => holding.collectionId)
      ];
      collections = await fetchAlchemyCollections(collectionIds);
    } else {
      trades = await fetchWalletTrades(resolved.address);
      holdings = await fetchUserHoldings(resolved.address);
      const collectionIds = [
        ...trades.map((trade) => trade.collectionId),
        ...holdings.map((holding) => holding.collectionId)
      ];
      collections = await fetchCollections(collectionIds);
      for (const id of new Set(collectionIds.map((value) => value.toLowerCase()))) {
        const history = await fetchCollectionFloorEvents(
          id,
          Math.floor(new Date("2021-01-01T00:00:00Z").getTime() / 1000),
          Math.floor(Date.now() / 1000)
        );
        floorHistory.set(id, history);
      }
    }
  } catch {
    trades = await fetchAlchemyTrades(resolved.address);
    holdings = await fetchAlchemyHoldings(resolved.address);
    if (trades.length === 0) {
      activityCountOverride = await fetchAlchemyTransferActivityCount(resolved.address).catch(() => 0);
    }
    const collectionIds = [
      ...trades.map((trade) => trade.collectionId),
      ...holdings.map((holding) => holding.collectionId)
    ];
    collections = await fetchAlchemyCollections(collectionIds);
  }

  const collectionIds = [
    ...trades.map((trade) => trade.collectionId),
    ...holdings.map((holding) => holding.collectionId)
  ];

  const gasSummary = await fetchGasSummary(
    resolved.address,
    [...new Set(trades.map((trade) => trade.txHash).filter(Boolean))]
  );

  const { findings, summary } = buildFindings({
    trades,
    holdings,
    collections,
    floorHistory,
    gasSummary,
    activityCountOverride
  });

  const displayName = resolved.ensName ?? shortAddress(resolved.address);
  const defaultCases =
    findings.length > 0
      ? defaultCaseStudies(findings)
      : buildActivityOnlyCaseStudies(summary);
  const defaults = {
    caseStudies: defaultCases,
    headlineFinding: {
      text:
        defaultCases[0]?.aftermath ??
        (summary.txnCount > 0
          ? "The Bureau confirmed NFT activity in the subject's file, but the sale receipts remain elusive."
          : "The Bureau found sufficient cause for concern."),
      loss:
        defaultCases[0]?.counterfactual ??
        (summary.txnCount > 0
          ? "The chain remembers movement. It does not, in this instance, remember what the subject paid."
          : "Material underperformance noted.")
    },
    severityRating: deriveRating(defaultCases.length, summary)
  };

  const generated = findings.length
    ? await generateCommentary({
        wallet: resolved.address,
        displayName,
        rawFindings: findings,
        summary
      }).catch(() => defaults)
    : defaults;

  const report: AuditReport = {
    wallet: resolved.address,
    displayName,
    caseNumber: deterministicCaseNumber(resolved.address),
    generatedAt: new Date().toISOString(),
    summary,
    caseStudies: generated.caseStudies.length ? generated.caseStudies : defaultCases,
    severityRating: generated.severityRating,
    headlineFinding: generated.headlineFinding,
    shareBaseUrl: process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SHARE_BASE_URL
  };

  await setCachedJson(cacheKey, report, AUDIT_TTL_SECONDS);
  return report;
}

export function auditVersionHash(report: AuditReport) {
  return sha1(`${AUDIT_SCHEMA_VERSION}:${report.wallet}:${report.generatedAt}:${report.caseStudies.map((caseStudy) => caseStudy.title).join("|")}`);
}

function deriveRating(caseCount: number, summary: AuditReport["summary"]) {
  if (caseCount === 1 && summary.txnCount > 0 && summary.realizedPnl === "Unpriced") {
    return {
      grade: "C-",
      label: "Receipts Missing",
      outlook: "Stable",
      blurb: "The Bureau confirmed that the subject was active onchain. It did not, however, receive enough sale pricing data to quantify the damage with the dignity this office prefers."
    };
  }

  const negativeCases = [
    summary.rugCount,
    summary.heldToZeroCount,
    summary.realizedPnl.startsWith("-") ? 1 : 0
  ].reduce((sum, count) => sum + count, 0);

  if (negativeCases >= 5 || caseCount >= 5) {
    return {
      grade: "F",
      label: "Utterly Moronic",
      outlook: "Negative",
      blurb: "The subject's onchain conduct falls well below the threshold of defensible judgment. The outlook remains negative."
    };
  }
  if (negativeCases >= 3) {
    return {
      grade: "D+",
      label: "Tragic",
      outlook: "Negative",
      blurb: "The Bureau observes repeated lapses in judgment, interrupted only occasionally by luck."
    };
  }
  return {
    grade: "C",
    label: "Not Recoverable",
    outlook: "Stable",
    blurb: "The file contains cause for concern, though not without isolated signs of adult supervision."
  };
}

function buildActivityOnlyCaseStudies(summary: AuditReport["summary"]): CaseStudy[] {
  if (summary.txnCount <= 0) return [];

  return [
    {
      id: "I",
      category: "Exhibit A · Incomplete Record",
      title: "The Receipts Are Missing, Not the Behavior",
      asset: "NFT transfer activity, 2021–present",
      acquired: {
        date: "On file",
        price: "Unpriced",
        usd: "—"
      },
      disposed: {
        date: "On file",
        price: "Unpriced",
        usd: "—"
      },
      aftermath: `The Bureau confirmed approximately ${summary.txnCount} NFT transfer events tied to the subject, but the sale ledger did not arrive in a form suitable for ridicule by spreadsheet.`,
      counterfactual: "The chain remembers movement. It does not, in this instance, remember what the subject paid.",
      commentary:
        "This is not a clean bill of health. It is merely an incomplete file. The subject was visibly active; the available pricing data was not.",
      severity: "Underdocumented"
    }
  ];
}
