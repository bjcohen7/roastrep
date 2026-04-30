import type {
  CaseStudy,
  CollectionFloorEvent,
  CollectionSnapshot,
  GasSummary,
  Holding,
  NormalizedTrade,
  RawFinding,
  Summary
} from "@/lib/types";
import { formatDate, formatNative, formatUsd, toDisplayPrice } from "@/lib/utils";

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;
const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60;
const SIX_MONTHS_SECONDS = 180 * 24 * 60 * 60;
const SIXTY_DAYS_SECONDS = 60 * 24 * 60 * 60;

type CollectionFloorMap = Map<string, CollectionFloorEvent[]>;

export function buildFindings(params: {
  trades: NormalizedTrade[];
  holdings: Holding[];
  collections: Map<string, CollectionSnapshot>;
  floorHistory: CollectionFloorMap;
  gasSummary: GasSummary;
  nowTimestamp?: number;
}) {
  const now = params.nowTimestamp ?? Math.floor(Date.now() / 1000);
  const pairedTrades = pairTrades(params.trades);
  const realizedTrades = pairedTrades.filter((pair) => pair.buy && pair.sell);
  const openLots = buildOpenLots(params.trades);
  const inferredHoldings = params.holdings.map((holding) => {
    const lot = openLots.get(`${holding.contract.toLowerCase()}:${holding.tokenId}`);
    const buy = lot?.[lot.length - 1];
    return {
      ...holding,
      acquiredTimestamp: holding.acquiredTimestamp ?? buy?.timestamp ?? null,
      acquiredPriceNative: holding.acquiredPriceNative ?? buy?.priceNative ?? null,
      acquiredPriceUsd: holding.acquiredPriceUsd ?? buy?.priceUsd ?? null
    };
  });

  const findings: RawFinding[] = [];

  const paperHands = realizedTrades
    .map((pair) => {
      const events = params.floorHistory.get(pair.buy.collectionId.toLowerCase()) ?? [];
      const peak = peakFloorInWindow(events, pair.sell.timestamp, pair.sell.timestamp + ONE_YEAR_SECONDS);
      const currentFloor = params.collections.get(pair.buy.collectionId.toLowerCase())?.currentFloorNative ?? null;
      const comparablePeak = peak ?? currentFloor;
      if (comparablePeak == null || comparablePeak < pair.sell.priceNative * 5) return null;

      return {
        key: "paper_hands" as const,
        sortValue: comparablePeak - pair.sell.priceNative,
        asset: displayAssetName(pair.buy.collectionName, pair.buy.tokenName, pair.buy.tokenId),
        collectionName: pair.buy.collectionName,
        acquisition: makeEntry(pair.buy.timestamp, pair.buy.priceNative, pair.buy.priceUsd, pair.buy.currencySymbol),
        disposition: makeEntry(pair.sell.timestamp, pair.sell.priceNative, pair.sell.priceUsd, pair.sell.currencySymbol),
        facts: {
          peakNative: comparablePeak,
          peakUsd: inferUsdFromRatio(pair.sell.priceNative, pair.sell.priceUsd, comparablePeak),
          peakDate: formatDate(pair.sell.timestamp + THIRTY_DAYS_SECONDS),
          forfeitedUsd: computeDeltaUsd(pair.sell.priceNative, pair.sell.priceUsd, comparablePeak),
          forfeitedNative: comparablePeak - pair.sell.priceNative
        }
      };
    })
    .filter(Boolean) as RawFinding[];

  const topTick = realizedTrades
    .map((pair) => {
      const events = params.floorHistory.get(pair.buy.collectionId.toLowerCase()) ?? [];
      const ath = absolutePeak(events);
      const currentFloor = params.collections.get(pair.buy.collectionId.toLowerCase())?.currentFloorNative ?? null;
      if (ath == null || currentFloor == null) return null;
      const withinThirtyDays = Math.abs(pair.buy.timestamp - ath.timestamp) <= THIRTY_DAYS_SECONDS;
      const downBad = currentFloor <= pair.buy.priceNative * 0.3;
      if (!withinThirtyDays || !downBad) return null;

      return {
        key: "top_tick" as const,
        sortValue: pair.buy.priceNative - currentFloor,
        asset: displayAssetName(pair.buy.collectionName, pair.buy.tokenName, pair.buy.tokenId),
        collectionName: pair.buy.collectionName,
        acquisition: makeEntry(pair.buy.timestamp, pair.buy.priceNative, pair.buy.priceUsd, pair.buy.currencySymbol),
        disposition: makeEntry(pair.sell.timestamp, pair.sell.priceNative, pair.sell.priceUsd, pair.sell.currencySymbol),
        facts: {
          athFloorNative: ath.value,
          athDate: formatDate(ath.timestamp),
          currentFloorNative: currentFloor,
          realizedLossUsd: (pair.sell.priceUsd ?? 0) - (pair.buy.priceUsd ?? 0)
        }
      };
    })
    .filter(Boolean) as RawFinding[];

  const diamondHands = inferredHoldings
    .map((holding) => {
      if (!holding.acquiredTimestamp || !holding.acquiredPriceNative || !holding.currentFloorNative) return null;
      if (now - holding.acquiredTimestamp < SIX_MONTHS_SECONDS) return null;
      if (holding.currentFloorNative >= holding.acquiredPriceNative * 0.05) return null;

      return {
        key: "diamond_hands" as const,
        sortValue: holding.acquiredPriceNative - holding.currentFloorNative,
        asset: displayAssetName(holding.collectionName, holding.tokenName, holding.tokenId),
        collectionName: holding.collectionName,
        acquisition: makeEntry(
          holding.acquiredTimestamp,
          holding.acquiredPriceNative,
          holding.acquiredPriceUsd,
          "ETH"
        ),
        disposition: makeEntry(null, null, null, "ETH"),
        facts: {
          currentFloorNative: holding.currentFloorNative,
          currentFloorUsd: holding.currentFloorUsd,
          unrealizedLossUsd: (holding.currentFloorUsd ?? 0) - (holding.acquiredPriceUsd ?? 0)
        }
      };
    })
    .filter(Boolean) as RawFinding[];

  const rugpulls = inferredHoldings
    .map((holding) => {
      const snapshot = params.collections.get(holding.collectionId.toLowerCase());
      if (!snapshot || !holding.acquiredPriceNative || !holding.acquiredTimestamp) return null;
      const lastEvent = (params.floorHistory.get(holding.collectionId.toLowerCase()) ?? []).at(-1);
      const stale = !lastEvent || now - lastEvent.timestamp >= SIXTY_DAYS_SECONDS;
      const floorGone = (snapshot.currentFloorNative ?? 0) <= 0.01;
      const hadAttention = (snapshot.volumeAllTime ?? 0) >= 100;
      if (!stale || !floorGone || !hadAttention) return null;

      return {
        key: "rugpull" as const,
        sortValue: holding.acquiredPriceNative,
        asset: displayAssetName(holding.collectionName, holding.tokenName, holding.tokenId),
        collectionName: holding.collectionName,
        acquisition: makeEntry(
          holding.acquiredTimestamp,
          holding.acquiredPriceNative,
          holding.acquiredPriceUsd,
          "ETH"
        ),
        disposition: makeEntry(null, null, null, "ETH"),
        facts: {
          inactivityDays: Math.floor((now - (lastEvent?.timestamp ?? holding.acquiredTimestamp)) / 86400),
          currentFloorNative: snapshot.currentFloorNative,
          cumulativeLossUsd: holding.acquiredPriceUsd
        }
      };
    })
    .filter(Boolean) as RawFinding[];

  const bestTrade = realizedTrades
    .map((pair) => ({
      pair,
      usdGain: (pair.sell.priceUsd ?? 0) - (pair.buy.priceUsd ?? 0),
      nativeGain: pair.sell.priceNative - pair.buy.priceNative
    }))
    .sort((a, b) => compareMetric(metricValue(b.usdGain, b.nativeGain), metricValue(a.usdGain, a.nativeGain)))[0];

  const worstRealizedTrade = realizedTrades
    .map((pair) => ({
      pair,
      usdLoss: (pair.sell.priceUsd ?? 0) - (pair.buy.priceUsd ?? 0),
      nativeLoss: pair.sell.priceNative - pair.buy.priceNative
    }))
    .sort((a, b) => compareMetric(metricValue(a.usdLoss, a.nativeLoss), metricValue(b.usdLoss, b.nativeLoss)))[0];

  if (bestTrade) {
    findings.push({
      key: "notable_competence",
      sortValue: bestTrade.usdGain,
      asset: displayAssetName(bestTrade.pair.buy.collectionName, bestTrade.pair.buy.tokenName, bestTrade.pair.buy.tokenId),
      collectionName: bestTrade.pair.buy.collectionName,
      acquisition: makeEntry(
        bestTrade.pair.buy.timestamp,
        bestTrade.pair.buy.priceNative,
        bestTrade.pair.buy.priceUsd,
        bestTrade.pair.buy.currencySymbol
      ),
      disposition: makeEntry(
        bestTrade.pair.sell.timestamp,
        bestTrade.pair.sell.priceNative,
        bestTrade.pair.sell.priceUsd,
        bestTrade.pair.sell.currencySymbol
      ),
      facts: {
        realizedGainUsd: bestTrade.usdGain,
        realizedGainNative: bestTrade.nativeGain
      }
    });
  }

  findings.push(...paperHands.sort((a, b) => b.sortValue - a.sortValue).slice(0, 1));
  findings.push(...topTick.sort((a, b) => b.sortValue - a.sortValue).slice(0, 1));
  findings.push(...diamondHands.sort((a, b) => b.sortValue - a.sortValue).slice(0, 1));
  findings.push(...rugpulls.sort((a, b) => b.sortValue - a.sortValue).slice(0, 1));

  if (params.gasSummary.available) {
    findings.push({
      key: "gas_martyrdom",
      sortValue: params.gasSummary.totalNative,
      asset: "Cumulative gas, 2021–present",
      acquisition: makeEntry(null, params.gasSummary.totalNative, params.gasSummary.totalUsd, "ETH"),
      disposition: makeEntry(null, null, null, "ETH"),
      facts: {
        singleDayHighNative: params.gasSummary.singleDayHighNative,
        singleDayHighUsd: params.gasSummary.singleDayHighUsd,
        singleDayDate: params.gasSummary.singleDayDate,
        transactionCount: params.gasSummary.transactionCount
      }
    });
  }

  if (!findings.some((item) => item.key === "top_tick") && worstRealizedTrade && worstRealizedTrade.nativeLoss < 0) {
    findings.push({
      key: "top_tick",
      sortValue: Math.abs(worstRealizedTrade.nativeLoss),
      asset: displayAssetName(
        worstRealizedTrade.pair.buy.collectionName,
        worstRealizedTrade.pair.buy.tokenName,
        worstRealizedTrade.pair.buy.tokenId
      ),
      collectionName: worstRealizedTrade.pair.buy.collectionName,
      acquisition: makeEntry(
        worstRealizedTrade.pair.buy.timestamp,
        worstRealizedTrade.pair.buy.priceNative,
        worstRealizedTrade.pair.buy.priceUsd,
        worstRealizedTrade.pair.buy.currencySymbol
      ),
      disposition: makeEntry(
        worstRealizedTrade.pair.sell.timestamp,
        worstRealizedTrade.pair.sell.priceNative,
        worstRealizedTrade.pair.sell.priceUsd,
        worstRealizedTrade.pair.sell.currencySymbol
      ),
      facts: {
        athFloorNative: worstRealizedTrade.pair.buy.priceNative,
        athDate: formatDate(worstRealizedTrade.pair.buy.timestamp),
        currentFloorNative: worstRealizedTrade.pair.sell.priceNative,
        realizedLossUsd: worstRealizedTrade.usdLoss,
        realizedLossNative: Math.abs(worstRealizedTrade.nativeLoss)
      }
    });
  }

  if (!findings.some((item) => item.key === "diamond_hands")) {
    const proxyDiamond = inferredHoldings
      .filter((holding) => holding.acquiredPriceNative && holding.currentFloorNative != null)
      .map((holding) => ({
        holding,
        drawdown: (holding.acquiredPriceNative ?? 0) - (holding.currentFloorNative ?? 0)
      }))
      .sort((a, b) => b.drawdown - a.drawdown)[0];

    if (proxyDiamond && proxyDiamond.drawdown > 0) {
      findings.push({
        key: "diamond_hands",
        sortValue: proxyDiamond.drawdown,
        asset: displayAssetName(
          proxyDiamond.holding.collectionName,
          proxyDiamond.holding.tokenName,
          proxyDiamond.holding.tokenId
        ),
        collectionName: proxyDiamond.holding.collectionName,
        acquisition: makeEntry(
          proxyDiamond.holding.acquiredTimestamp,
          proxyDiamond.holding.acquiredPriceNative,
          proxyDiamond.holding.acquiredPriceUsd,
          "ETH"
        ),
        disposition: makeEntry(null, null, null, "ETH"),
        facts: {
          currentFloorNative: proxyDiamond.holding.currentFloorNative,
          currentFloorUsd: proxyDiamond.holding.currentFloorUsd,
          unrealizedLossUsd: (proxyDiamond.holding.currentFloorUsd ?? 0) - (proxyDiamond.holding.acquiredPriceUsd ?? 0),
          unrealizedLossNative: proxyDiamond.drawdown
        }
      });
    }
  }

  const filteredFindings = prioritizeFindings(findings);
  const summary = buildSummary(params.trades, filteredFindings, params.gasSummary, params.holdings);
  return { findings: filteredFindings, summary };
}

export function defaultCaseStudies(rawFindings: RawFinding[]): CaseStudy[] {
  return rawFindings.map((finding, index) => {
    const numeral = ["I", "II", "III", "IV", "V", "VI"][index] ?? String(index + 1);
    const exhibit = String.fromCharCode(65 + index);
    const categoryMap: Record<RawFinding["key"], string> = {
      paper_hands: "Paper Hands",
      top_tick: "Top-Tick Specialist",
      diamond_hands: "Diamond Hands Disaster",
      rugpull: "Connoisseur of Rugpulls",
      gas_martyrdom: "Gas Fee Martyrdom",
      notable_competence: "Notable Competence"
    };

    return {
      id: numeral,
      category: `Exhibit ${exhibit} · ${categoryMap[finding.key]}`,
      title: fallbackTitle(finding.key),
      asset: finding.asset,
      acquired: {
        date: finding.acquisition.date,
        price: finding.acquisition.displayPrice,
        usd: formatUsd(finding.acquisition.priceUsd)
      },
      disposed: {
        date: finding.disposition.date,
        price: finding.disposition.displayPrice,
        usd: formatUsd(finding.disposition.priceUsd)
      },
      aftermath: fallbackAftermath(finding),
      counterfactual: fallbackCounterfactual(finding),
      commentary: fallbackCommentary(finding.key),
      severity: fallbackSeverity(finding.key)
    };
  });
}

function pairTrades(trades: NormalizedTrade[]) {
  const openLots = new Map<string, NormalizedTrade[]>();
  const pairs: Array<{ buy: NormalizedTrade; sell: NormalizedTrade }> = [];

  for (const trade of trades) {
    const key = `${trade.contract}:${trade.tokenId}`;
    const queue = openLots.get(key) ?? [];

    if (trade.side === "buy") {
      queue.push(trade);
      openLots.set(key, queue);
      continue;
    }

    const buy = queue.shift();
    if (buy) {
      pairs.push({ buy, sell: trade });
    }
    openLots.set(key, queue);
  }

  return pairs;
}

function buildOpenLots(trades: NormalizedTrade[]) {
  const openLots = new Map<string, NormalizedTrade[]>();

  for (const trade of trades) {
    const key = `${trade.contract.toLowerCase()}:${trade.tokenId}`;
    const queue = openLots.get(key) ?? [];
    if (trade.side === "buy") {
      queue.push(trade);
    } else {
      queue.shift();
    }
    openLots.set(key, queue);
  }

  return openLots;
}

function displayAssetName(collectionName: string, tokenName: string, tokenId: string) {
  const cleanedCollection = collectionName?.trim() || "Collection";
  const cleanedToken = tokenName?.trim() || "";
  const normalizedTokenId = tokenId?.trim() || "";

  if (!cleanedToken) {
    return normalizedTokenId ? `${cleanedCollection} #${normalizedTokenId}` : cleanedCollection;
  }

  if (cleanedToken === cleanedCollection) {
    return normalizedTokenId ? `${cleanedCollection} #${normalizedTokenId}` : cleanedCollection;
  }

  if (/^#?\d+$/.test(cleanedToken)) {
    const suffix = cleanedToken.startsWith("#") ? cleanedToken : `#${cleanedToken}`;
    return `${cleanedCollection} ${suffix}`;
  }

  if (/^token\s*#?\d+$/i.test(cleanedToken)) {
    const numeric = cleanedToken.match(/\d+/)?.[0] ?? normalizedTokenId;
    return numeric ? `${cleanedCollection} #${numeric}` : cleanedCollection;
  }

  return cleanedToken;
}

function peakFloorInWindow(events: CollectionFloorEvent[], start: number, end: number) {
  let peak: number | null = null;
  for (const event of events) {
    if (event.timestamp < start || event.timestamp > end) continue;
    if (event.floorNative == null) continue;
    peak = peak == null ? event.floorNative : Math.max(peak, event.floorNative);
  }
  return peak;
}

function absolutePeak(events: CollectionFloorEvent[]) {
  let peak: { value: number; timestamp: number } | null = null;
  for (const event of events) {
    if (event.floorNative == null) continue;
    if (!peak || event.floorNative > peak.value) {
      peak = { value: event.floorNative, timestamp: event.timestamp };
    }
  }
  return peak;
}

function makeEntry(timestamp: number | null, native: number | null, usd: number | null, symbol: string) {
  return {
    date: timestamp ? formatDate(timestamp) : "— still held —",
    priceNative: native,
    priceUsd: usd,
    displayPrice: timestamp || native != null ? formatNative(native, symbol) : "—"
  };
}

function inferUsdFromRatio(baseNative: number, baseUsd: number | null, targetNative: number) {
  if (!baseUsd || !baseNative) return null;
  return (baseUsd / baseNative) * targetNative;
}

function computeDeltaUsd(baseNative: number, baseUsd: number | null, targetNative: number) {
  const targetUsd = inferUsdFromRatio(baseNative, baseUsd, targetNative);
  if (targetUsd == null || baseUsd == null) return null;
  return targetUsd - baseUsd;
}

function prioritizeFindings(findings: RawFinding[]) {
  const required: RawFinding["key"][] = [
    "paper_hands",
    "top_tick",
    "diamond_hands",
    "rugpull",
    "gas_martyrdom",
    "notable_competence"
  ];

  return required.flatMap((key) => {
    const finding = findings.find((item) => item.key === key);
    return finding ? [finding] : [];
  });
}

function buildSummary(
  trades: NormalizedTrade[],
  findings: RawFinding[],
  gasSummary: GasSummary,
  holdings: Holding[]
): Summary {
  const sells = trades.filter((trade) => trade.side === "sell");
  const buys = trades.filter((trade) => trade.side === "buy");
  const realized = sells.reduce((sum, trade) => sum + (trade.priceUsd ?? 0), 0) - buys.reduce((sum, trade) => sum + (trade.priceUsd ?? 0), 0);
  const realizedNative = sells.reduce((sum, trade) => sum + trade.priceNative, 0) - buys.reduce((sum, trade) => sum + trade.priceNative, 0);
  const unrealized = holdings.reduce((sum, holding) => {
    if (holding.currentFloorUsd == null || holding.acquiredPriceUsd == null) return sum;
    return sum + (holding.currentFloorUsd - holding.acquiredPriceUsd);
  }, 0);
  const unrealizedNative = holdings.reduce((sum, holding) => {
    if (holding.currentFloorNative == null || holding.acquiredPriceNative == null) return sum;
    return sum + (holding.currentFloorNative - holding.acquiredPriceNative);
  }, 0);

  const best = findings.find((finding) => finding.key === "notable_competence");
  const worst = findings.find((finding) => finding.key === "paper_hands") ?? findings.find((finding) => finding.key === "top_tick");
  const rugCount = findings.filter((finding) => finding.key === "rugpull").length;
  const heldToZeroCount = findings.filter((finding) => finding.key === "diamond_hands").length;

  return {
    periodStart: "Jan 2021",
    periodEnd: new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" }),
    txnCount: trades.length,
    realizedPnl: realized !== 0 ? formatUsd(realized) : formatNative(realizedNative, "ETH"),
    unrealizedPnl: unrealized !== 0 ? formatUsd(unrealized) : formatNative(unrealizedNative, "ETH"),
    rugCount,
    heldToZeroCount,
    gasSpent: gasSummary.available
      ? (formatUsd(gasSummary.totalUsd) === "—" ? formatNative(gasSummary.totalNative, "ETH") : formatUsd(gasSummary.totalUsd))
      : "—",
    bestSingleTrade: best ? formatMetric(best.facts.realizedGainUsd, best.facts.realizedGainNative, false) : "0 ETH",
    worstSingleTrade: worst ? formatMetric(negativeValue(worst.facts.forfeitedUsd ?? worst.facts.realizedLossUsd), worst.facts.realizedLossNative ?? worst.facts.forfeitedNative, true) : "0 ETH"
  };
}

function fallbackTitle(key: RawFinding["key"]) {
  switch (key) {
    case "paper_hands":
      return "An Untimely Departure";
    case "top_tick":
      return "Acquisition at the Local Maximum";
    case "diamond_hands":
      return "Held With Conviction. To Zero.";
    case "rugpull":
      return "A Discerning Palate";
    case "gas_martyrdom":
      return "An Offering to the Network";
    case "notable_competence":
      return "An Inconvenient Triumph";
  }
}

function fallbackAftermath(finding: RawFinding) {
  if (finding.key === "paper_hands") {
    return `Asset later reached approximately ${formatNative(Number(finding.facts.peakNative ?? 0))}.`;
  }
  if (finding.key === "top_tick") {
    return `The subject entered near the collection's local high and the floor is now materially lower.`;
  }
  if (finding.key === "diamond_hands") {
    return `Current floor sits near ${formatNative(Number(finding.facts.currentFloorNative ?? 0))}. The position remains open.`;
  }
  if (finding.key === "rugpull") {
    return `Collection activity has gone dormant while the floor approaches irrelevance.`;
  }
  if (finding.key === "gas_martyrdom") {
    return `Single-day record: ${formatNative(Number(finding.facts.singleDayHighNative ?? 0))} on ${finding.facts.singleDayDate ?? "file"}.`;
  }
  return `The subject acquired at a defensible basis and exited with an actual profit.`;
}

function fallbackCounterfactual(finding: RawFinding) {
  if (finding.key === "paper_hands") {
    return formatMetricLine("in unrealized gains forfeited at peak", finding.facts.forfeitedUsd, finding.facts.forfeitedNative, true);
  }
  if (finding.key === "top_tick") {
    return `Realized loss: ${formatMetric(finding.facts.realizedLossUsd, finding.facts.realizedLossNative, true)}.`;
  }
  if (finding.key === "diamond_hands") {
    return `Unrealized loss: ${formatMetric(finding.facts.unrealizedLossUsd, finding.facts.unrealizedLossNative, true)}.`;
  }
  if (finding.key === "rugpull") {
    return `Capital effectively stranded: ${formatUsd(Number(finding.facts.cumulativeLossUsd ?? 0))}.`;
  }
  if (finding.key === "gas_martyrdom") {
    return `Equivalent value: ${formatNative(Number(finding.facts.singleDayHighNative ?? 0))} committed to transaction fees.`;
  }
  return `Realized gain: ${formatMetric(finding.facts.realizedGainUsd, finding.facts.realizedGainNative, false)}.`;
}

function fallbackCommentary(key: RawFinding["key"]) {
  switch (key) {
    case "paper_hands":
      return "The subject appears to have mistaken early profit for finality. The Bureau has seen this before.";
    case "top_tick":
      return "The entry timing suggests a deep respect for local maxima.";
    case "diamond_hands":
      return "Conviction, in this file, appears to have outlived the thesis by some margin.";
    case "rugpull":
      return "The subject demonstrates a recurring willingness to sponsor disappearing acts.";
    case "gas_martyrdom":
      return "The Bureau is not a religious organization. We have, however, taken note of the sacrifice.";
    case "notable_competence":
      return "The Bureau acknowledges this isolated act of competence in the interest of procedural fairness.";
  }
}

function fallbackSeverity(key: RawFinding["key"]) {
  switch (key) {
    case "paper_hands":
      return "Egregious";
    case "top_tick":
      return "Concerning";
    case "diamond_hands":
      return "Embarrassing";
    case "rugpull":
      return "Specialist-Grade";
    case "gas_martyrdom":
      return "Devotional";
    case "notable_competence":
      return "Begrudging";
  }
}

function metricValue(usd: number | null | undefined, native: number | null | undefined) {
  return Math.abs(usd ?? 0) > 0 ? Number(usd ?? 0) : Number(native ?? 0);
}

function compareMetric(a: number, b: number) {
  return a - b;
}

function formatMetric(
  usd: string | number | null | undefined,
  native: string | number | null | undefined,
  negative: boolean
) {
  const usdNumber = toNumber(usd);
  if (usdNumber != null && usdNumber !== 0) {
    return formatUsd(negative ? -Math.abs(usdNumber) : usdNumber);
  }
  const nativeNumber = toNumber(native) ?? 0;
  const signedNative = negative ? -Math.abs(nativeNumber) : nativeNumber;
  return formatNative(signedNative, "ETH");
}

function formatMetricLine(
  suffix: string,
  usd: string | number | null | undefined,
  native: string | number | null | undefined,
  negative: boolean
) {
  return `≈ ${formatMetric(usd, native, negative)} ${suffix}.`;
}

function negativeValue(value: unknown) {
  const number = toNumber(value);
  return number == null ? null : -Math.abs(number);
}

function toNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
