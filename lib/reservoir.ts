import { getAddress } from "viem";

import { getEnv } from "@/lib/env";
import type {
  CollectionFloorEvent,
  CollectionSnapshot,
  Holding,
  NormalizedTrade
} from "@/lib/types";

const RESERVOIR_BASE_URL = "https://api.reservoir.tools";
const START_TIMESTAMP = Math.floor(new Date("2021-01-01T00:00:00Z").getTime() / 1000);

type ReservoirActivityResponse = {
  activities?: unknown[];
  continuation?: string | null;
};

type ReservoirUserTokensResponse = {
  tokens?: unknown[];
  continuation?: string | null;
};

type ReservoirCollectionsResponse = {
  collections?: unknown[];
};

type ReservoirFloorEventsResponse = {
  events?: unknown[];
  continuation?: string | null;
};

function reservoirHeaders() {
  const apiKey = getEnv("RESERVOIR_API_KEY");
  return {
    "Content-Type": "application/json",
    ...(apiKey ? { "x-api-key": apiKey } : {})
  };
}

async function reservoirFetch<T>(path: string, searchParams?: URLSearchParams): Promise<T> {
  const url = `${RESERVOIR_BASE_URL}${path}${searchParams ? `?${searchParams}` : ""}`;
  const response = await fetch(url, {
    headers: reservoirHeaders(),
    next: { revalidate: 0 }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Reservoir request failed (${response.status}): ${body}`);
  }

  return response.json() as Promise<T>;
}

export async function fetchWalletTrades(wallet: string) {
  const address = getAddress(wallet);
  const trades: NormalizedTrade[] = [];
  let continuation: string | null | undefined;

  do {
    const params = new URLSearchParams();
    params.set("users", address);
    params.set("types", "sale");
    params.set("limit", "20");
    params.set("sortBy", "eventTimestamp");
    params.set("includeMetadata", "true");
    params.set("excludeSpam", "true");
    params.set("excludeNsfw", "true");
    if (continuation) params.set("continuation", continuation);

    const payload = await reservoirFetch<ReservoirActivityResponse>("/users/activity/v6", params);
    continuation = payload.continuation;

    for (const item of payload.activities ?? []) {
      const trade = normalizeTrade(item, address);
      if (!trade) continue;
      if (trade.timestamp < START_TIMESTAMP) {
        continuation = null;
        break;
      }
      trades.push(trade);
    }
  } while (continuation);

  return trades.sort((a, b) => a.timestamp - b.timestamp);
}

export async function fetchUserHoldings(wallet: string): Promise<Holding[]> {
  const holdings: Holding[] = [];
  let continuation: string | null | undefined;

  do {
    const params = new URLSearchParams();
    params.set("limit", "200");
    params.set("sortBy", "acquiredAt");
    params.set("includeTopBid", "false");
    params.set("excludeSpam", "true");
    if (continuation) params.set("continuation", continuation);

    const payload = await reservoirFetch<ReservoirUserTokensResponse>(`/users/${wallet}/tokens/v6`, params);
    continuation = payload.continuation;

    for (const item of payload.tokens ?? []) {
      const holding = normalizeHolding(item);
      if (holding) holdings.push(holding);
    }
  } while (continuation);

  return holdings;
}

export async function fetchCollections(contractIds: string[]): Promise<Map<string, CollectionSnapshot>> {
  const uniqueIds = [...new Set(contractIds)].filter(Boolean);
  const result = new Map<string, CollectionSnapshot>();

  for (let i = 0; i < uniqueIds.length; i += 20) {
    const batch = uniqueIds.slice(i, i + 20);
    const params = new URLSearchParams();
    for (const id of batch) params.append("id", id);
    const payload = await reservoirFetch<ReservoirCollectionsResponse>("/collections/v7", params);

    for (const item of payload.collections ?? []) {
      const snapshot = normalizeCollection(item);
      if (snapshot) result.set(snapshot.id.toLowerCase(), snapshot);
    }
  }

  return result;
}

export async function fetchCollectionFloorEvents(
  contract: string,
  startTimestamp: number,
  endTimestamp: number
): Promise<CollectionFloorEvent[]> {
  const events: CollectionFloorEvent[] = [];
  let continuation: string | null | undefined;

  do {
    const params = new URLSearchParams();
    params.set("collection", contract);
    params.set("startTimestamp", String(startTimestamp));
    params.set("endTimestamp", String(endTimestamp));
    params.set("limit", "1000");
    if (continuation) params.set("continuation", continuation);

    const payload = await reservoirFetch<ReservoirFloorEventsResponse>("/events/collections/floor-ask/v2", params);
    continuation = payload.continuation;

    for (const item of payload.events ?? []) {
      const normalized = normalizeFloorEvent(item);
      if (normalized) events.push(normalized);
    }
  } while (continuation);

  return events.sort((a, b) => a.timestamp - b.timestamp);
}

function normalizeTrade(item: unknown, wallet: string): NormalizedTrade | null {
  const activity = item as Record<string, any>;
  const token = activity.token ?? {};
  const fromAddress = normalizeAddress(activity.fromAddress ?? activity.from);
  const toAddress = normalizeAddress(activity.toAddress ?? activity.to);
  const walletLower = wallet.toLowerCase();

  const side =
    toAddress === walletLower ? "buy" :
    fromAddress === walletLower ? "sell" :
    null;

  if (!side) return null;

  const contract = normalizeAddress(token.contract ?? activity.contract);
  const tokenId = String(token.tokenId ?? activity.tokenId ?? "");
  const collectionId = String(token.collection?.id ?? activity.collection?.id ?? contract ?? "");
  const timestamp = Number(activity.eventTimestamp ?? activity.timestamp ?? 0);
  const native = readNumeric(
    activity.price?.amount?.native ??
    activity.price?.amount?.decimal ??
    activity.price?.amount ??
    activity.price
  );
  const usd = readNumeric(activity.price?.amount?.usd ?? activity.price?.usd);

  if (!contract || !tokenId || !timestamp || native == null) return null;

  return {
    side,
    txHash: String(activity.txHash ?? activity.transactionHash ?? ""),
    contract,
    tokenId,
    collectionId,
    collectionName: String(token.collection?.name ?? activity.collection?.name ?? "Unknown Collection"),
    tokenName: String(token.name ?? `${token.collection?.name ?? "Token"} #${tokenId}`),
    image: token.image ?? null,
    timestamp,
    priceNative: native,
    priceUsd: usd,
    currencySymbol: String(activity.price?.currency?.symbol ?? "ETH"),
    fromAddress: fromAddress ?? undefined,
    toAddress: toAddress ?? undefined
  };
}

function normalizeHolding(item: unknown): Holding | null {
  const wrapped = item as Record<string, any>;
  const token = wrapped.token ?? wrapped;
  const contract = normalizeAddress(token.contract);
  const tokenId = String(token.tokenId ?? "");
  if (!contract || !tokenId) return null;

  return {
    contract,
    tokenId,
    collectionId: String(token.collection?.id ?? contract),
    collectionName: String(token.collection?.name ?? "Unknown Collection"),
    tokenName: String(token.name ?? `${token.collection?.name ?? "Token"} #${tokenId}`),
    image: token.image ?? null,
    acquiredTimestamp: readNumeric(token.ownership?.acquiredAt ?? wrapped.acquiredAt),
    acquiredPriceNative: readNumeric(token.ownership?.floorAskPrice?.amount?.native ?? wrapped.lastBuy?.price?.amount?.native),
    acquiredPriceUsd: readNumeric(token.ownership?.floorAskPrice?.amount?.usd ?? wrapped.lastBuy?.price?.amount?.usd),
    currentFloorNative: readNumeric(token.market?.floorAsk?.price?.amount?.native),
    currentFloorUsd: readNumeric(token.market?.floorAsk?.price?.amount?.usd)
  };
}

function normalizeCollection(item: unknown): CollectionSnapshot | null {
  const collection = item as Record<string, any>;
  const id = String(collection.id ?? "");
  if (!id) return null;
  return {
    id,
    name: String(collection.name ?? id),
    image: collection.image ?? null,
    currentFloorNative: readNumeric(collection.floorAsk?.price?.amount?.native),
    currentFloorUsd: readNumeric(collection.floorAsk?.price?.amount?.usd),
    volume30d: readNumeric(collection.volume?.["30day"] ?? collection.volume30day),
    volumeAllTime: readNumeric(collection.volume?.allTime ?? collection.allTimeVolume),
    tokenCount: readNumeric(collection.tokenCount)
  };
}

function normalizeFloorEvent(item: unknown): CollectionFloorEvent | null {
  const event = item as Record<string, any>;
  const timestamp = Number(event.createdAt ?? event.eventTimestamp ?? event.timestamp ?? 0);
  if (!timestamp) return null;

  return {
    timestamp,
    floorNative: readNumeric(event.floorAsk?.price?.amount?.native ?? event.price?.amount?.native),
    floorUsd: readNumeric(event.floorAsk?.price?.amount?.usd ?? event.price?.amount?.usd),
    eventType: typeof event.event?.kind === "string" ? event.event.kind : undefined
  };
}

function normalizeAddress(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    return getAddress(value).toLowerCase();
  } catch {
    return null;
  }
}

function readNumeric(value: unknown) {
  if (value == null || value === "") return null;
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}
