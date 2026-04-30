import { DEFAULT_SHARE_BASE_URL } from "@/lib/constants";
import { getEnv } from "@/lib/env";
import { getCachedJson, setCachedJson } from "@/lib/cache";
import { fetchAlchemyCollections, fetchAlchemyHoldings, fetchAlchemyTrades } from "@/lib/alchemy";
import { generateCommentary } from "@/lib/claude";
import { resolveWalletOrEns } from "@/lib/ens";
import { fetchGasSummary } from "@/lib/etherscan";
import { buildFindings, defaultCaseStudies } from "@/lib/findings";
import { fetchCollectionFloorEvents, fetchCollections, fetchUserHoldings, fetchWalletTrades } from "@/lib/reservoir";
import type { AuditReport, CollectionSnapshot, Holding, NormalizedTrade } from "@/lib/types";
import { deterministicCaseNumber, formatUsd, shortAddress, sha1 } from "@/lib/utils";

const AUDIT_TTL_SECONDS = 60 * 60 * 24;

export async function getAuditReport(subject: string, options?: { refresh?: boolean }) {
  const resolved = await resolveWalletOrEns(subject);
  const cacheKey = `audit:${resolved.address.toLowerCase()}`;
  const preferAlchemy = Boolean(getEnv("ALCHEMY_API_KEY"));

  if (!options?.refresh) {
    const cached = await getCachedJson<AuditReport>(cacheKey);
    if (cached) return cached;
  }

  let trades: NormalizedTrade[] = [];
  let holdings: Holding[] = [];
  let collections: Map<string, CollectionSnapshot> = new Map();
  const floorHistory = new Map<string, Awaited<ReturnType<typeof fetchCollectionFloorEvents>>>();

  try {
    if (preferAlchemy) {
      trades = await fetchAlchemyTrades(resolved.address);
      holdings = await fetchAlchemyHoldings(resolved.address);
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
    gasSummary
  });

  const displayName = resolved.ensName ?? shortAddress(resolved.address);
  const defaultCases = defaultCaseStudies(findings);
  const defaults = {
    caseStudies: defaultCases,
    headlineFinding: {
      text: defaultCases[0]?.aftermath ?? "The Bureau found sufficient cause for concern.",
      loss: defaultCases[0]?.counterfactual ?? "Material underperformance noted."
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
  return sha1(`${report.wallet}:${report.generatedAt}:${report.caseStudies.map((caseStudy) => caseStudy.title).join("|")}`);
}

function deriveRating(caseCount: number, summary: AuditReport["summary"]) {
  const negativeCases = [
    summary.rugCount,
    summary.heldToZeroCount,
    summary.realizedPnl.startsWith("-") ? 1 : 0
  ].reduce((sum, count) => sum + count, 0);

  if (negativeCases >= 5 || caseCount >= 5) {
    return {
      grade: "DDD−",
      label: "Catastrophic",
      outlook: "Negative",
      blurb: "The subject's onchain conduct falls well below investment-grade judgment. The outlook remains negative."
    };
  }
  if (negativeCases >= 3) {
    return {
      grade: "CC+",
      label: "Embarrassing",
      outlook: "Negative",
      blurb: "The Bureau observes repeated lapses in judgment, interrupted only occasionally by luck."
    };
  }
  return {
    grade: "BB",
    label: "Recoverable",
    outlook: "Stable",
    blurb: "The file contains cause for concern, though not without isolated signs of adult supervision."
  };
}
