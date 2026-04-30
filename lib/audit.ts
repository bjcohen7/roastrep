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
import { deterministicCaseNumber, formatDate, formatNative, formatUsd, shortAddress, sha1 } from "@/lib/utils";

const AUDIT_TTL_SECONDS = 60 * 60 * 24;
const AUDIT_SCHEMA_VERSION = "2026-04-30-activity-fallback";

export async function getCachedAuditReport(subject: string) {
  const resolved = await resolveWalletOrEns(subject);
  const cacheKey = `audit:${AUDIT_SCHEMA_VERSION}:${resolved.address.toLowerCase()}`;
  return getCachedJson<AuditReport>(cacheKey);
}

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
      // Fetch trades and holdings in parallel — this is the main latency win.
      [trades, holdings] = await Promise.all([
        fetchAlchemyTrades(resolved.address),
        fetchAlchemyHoldings(resolved.address)
      ]);
      if (trades.length === 0) {
        activityCountOverride = await fetchAlchemyTransferActivityCount(resolved.address).catch(() => 0);
      }
      const collectionIds = [
        ...trades.map((trade) => trade.collectionId),
        ...holdings.map((holding) => holding.collectionId)
      ];
      collections = await fetchAlchemyCollections(collectionIds);
    } else {
      // Fetch trades and holdings in parallel for the Reservoir path too.
      [trades, holdings] = await Promise.all([
        fetchWalletTrades(resolved.address),
        fetchUserHoldings(resolved.address)
      ]);
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
    // Fallback: try Alchemy directly, again in parallel.
    [trades, holdings] = await Promise.all([
      fetchAlchemyTrades(resolved.address).catch(() => [] as NormalizedTrade[]),
      fetchAlchemyHoldings(resolved.address).catch(() => [] as Holding[])
    ]);
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
      : buildActivityOnlyCaseStudies(summary, holdings, collections);
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
  if (summary.txnCount > 0 && summary.realizedPnl === "Unpriced") {
    if (caseCount >= 3) {
      return {
        grade: "D",
        label: "Suspiciously Busy",
        outlook: "Negative",
        blurb: "The Bureau confirmed repeated NFT activity and enough surviving debris to form opinions. The receipts are incomplete, but the judgment problems are not."
      };
    }
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

function buildActivityOnlyCaseStudies(
  summary: AuditReport["summary"],
  holdings: Holding[],
  collections: Map<string, CollectionSnapshot>
): CaseStudy[] {
  if (summary.txnCount <= 0) return [];

  const cases: CaseStudy[] = [
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

  const groupedHoldings = new Map<string, Holding[]>();
  for (const holding of holdings) {
    const key = holding.collectionId.toLowerCase();
    const bucket = groupedHoldings.get(key) ?? [];
    bucket.push(holding);
    groupedHoldings.set(key, bucket);
  }

  const dominantCollection = [...groupedHoldings.entries()]
    .map(([collectionId, bucket]) => ({
      collectionId,
      holdings: bucket,
      count: bucket.length,
      name: bucket[0]?.collectionName ?? collections.get(collectionId)?.name ?? "Unknown Collection"
    }))
    .sort((a, b) => b.count - a.count)[0];

  if (dominantCollection && dominantCollection.count >= 2) {
    const firstSeen = dominantCollection.holdings
      .map((holding) => holding.acquiredTimestamp ?? Number.POSITIVE_INFINITY)
      .filter(Number.isFinite)
      .sort((a, b) => a - b)[0];

    cases.push({
      id: "II",
      category: "Exhibit B · Collection Concentration",
      title: "A Repeated Commitment to the Same Idea",
      asset: `${dominantCollection.name} (${dominantCollection.count} tokens retained)`,
      acquired: {
        date: Number.isFinite(firstSeen) ? formatDate(firstSeen) : "On file",
        price: "Unpriced",
        usd: "—"
      },
      disposed: {
        date: "— still held —",
        price: "Open inventory",
        usd: "—"
      },
      aftermath: `The Bureau counted ${dominantCollection.count} surviving tokens in ${dominantCollection.name}, suggesting the subject did not merely visit this thesis but attempted residency.`,
      counterfactual: "Concentration risk is evident even where pricing discipline is not.",
      commentary:
        "When a wallet keeps returning to the same collection without producing clean profit records, the Bureau is left to conclude that conviction arrived well before documentation.",
      severity: "Overcommitted"
    });
  }

  const bleakHolding = holdings
    .filter((holding) => holding.currentFloorNative != null)
    .sort((a, b) => (a.currentFloorNative ?? Number.POSITIVE_INFINITY) - (b.currentFloorNative ?? Number.POSITIVE_INFINITY))[0];

  if (bleakHolding) {
    cases.push({
      id: cases.length === 1 ? "II" : "III",
      category: cases.length === 1 ? "Exhibit B · Residual Inventory" : "Exhibit C · Residual Inventory",
      title: "Inventory the Bureau Would Prefer Not to Itemize",
      asset: displayHoldingAsset(bleakHolding),
      acquired: {
        date: bleakHolding.acquiredTimestamp ? formatDate(bleakHolding.acquiredTimestamp) : "On file",
        price: "Unpriced",
        usd: "—"
      },
      disposed: {
        date: "— still held —",
        price: bleakHolding.currentFloorNative != null ? formatNative(bleakHolding.currentFloorNative, "ETH") : "Open inventory",
        usd: "—"
      },
      aftermath: `Current visible floor sits near ${bleakHolding.currentFloorNative != null ? formatNative(bleakHolding.currentFloorNative, "ETH") : "indeterminate levels"}, which is not the sort of phrase that typically precedes vindication.`,
      counterfactual: "The remaining inventory is documented. The upside is not.",
      commentary:
        "Even without acquisition pricing, the surviving position communicates enough on its own. The Bureau does not require a receipt to recognize stale inventory.",
      severity: "Lingering"
    });
  }

  return cases;
}

function displayHoldingAsset(holding: Holding) {
  const tokenName = holding.tokenName?.trim();
  const collectionName = holding.collectionName?.trim() || "Collection";
  const tokenId = holding.tokenId?.trim();

  if (!tokenName || tokenName === collectionName) {
    return tokenId ? `${collectionName} #${tokenId}` : collectionName;
  }

  if (/^#?\d+$/.test(tokenName)) {
    return `${collectionName} ${tokenName.startsWith("#") ? tokenName : `#${tokenName}`}`;
  }

  if (/^token\s*#?\d+$/i.test(tokenName)) {
    const numeric = tokenName.match(/\d+/)?.[0] ?? tokenId;
    return numeric ? `${collectionName} #${numeric}` : collectionName;
  }

  return tokenName;
}
