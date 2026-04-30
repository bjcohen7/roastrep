import { getAddress } from "viem";

import { getEnv } from "@/lib/env";
import type {
  CollectionSnapshot,
  Holding,
  NormalizedTrade
} from "@/lib/types";

const ALCHEMY_API_KEY = getEnv("ALCHEMY_API_KEY", "docs-demo");
const ALCHEMY_BASE_URL = `https://eth-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_API_KEY}`;
const START_BLOCK = "0";
const MAX_SALES_PAGES = 2;
const MAX_HOLDING_PAGES = 2;

type AlchemySalesResponse = {
  nftSales?: Array<Record<string, any>>;
  pageKey?: string | null;
};

type AlchemyNftsResponse = {
  ownedNfts?: Array<Record<string, any>>;
  pageKey?: string | null;
};

type AlchemyContractMetadata = Record<string, any>;

type AlchemyNftMetadata = Record<string, any>;

export async function fetchAlchemyTrades(wallet: string): Promise<NormalizedTrade[]> {
  const address = getAddress(wallet);
  const [buys, sells] = await Promise.all([
    fetchSalesForAddress(address, "buyerAddress", "buy"),
    fetchSalesForAddress(address, "sellerAddress", "sell")
  ]);

  return [...buys, ...sells].sort((a, b) => a.timestamp - b.timestamp);
}

export async function fetchAlchemyHoldings(wallet: string): Promise<Holding[]> {
  const holdings: Holding[] = [];
  let pageKey: string | null | undefined;
  let pageCount = 0;

  do {
    const url = new URL(`${ALCHEMY_BASE_URL}/getNFTsForOwner`);
    url.searchParams.set("owner", wallet);
    url.searchParams.set("withMetadata", "true");
    if (pageKey) url.searchParams.set("pageKey", pageKey);

    const payload = await alchemyFetch<AlchemyNftsResponse>(url.toString());
    pageKey = payload.pageKey;
    pageCount += 1;

    for (const item of payload.ownedNfts ?? []) {
      holdings.push({
        contract: String(item.contract?.address ?? ""),
        tokenId: decimalTokenId(item.tokenId ?? item.id?.tokenId),
        collectionId: String(item.contract?.address ?? ""),
        collectionName:
          String(
            item.contract?.name ??
            item.collection?.name ??
            item.contract?.openseaMetadata?.collectionName ??
            "Unknown Collection"
          ),
        tokenName: String(item.name ?? item.title ?? `Token #${item.tokenId ?? item.id?.tokenId ?? ""}`),
        image:
          item.image?.cachedUrl ??
          item.image?.thumbnailUrl ??
          item.image?.pngUrl ??
          item.image?.originalUrl ??
          null,
        acquiredTimestamp: toTimestamp(item.acquiredAt?.blockTimestamp),
        acquiredPriceNative: null,
        acquiredPriceUsd: null,
        currentFloorNative: numberOrNull(item.contract?.openseaMetadata?.floorPrice),
        currentFloorUsd: null
      });
    }
  } while (pageKey && pageCount < MAX_HOLDING_PAGES);

  return holdings.filter((holding) => holding.contract && holding.tokenId);
}

export async function fetchAlchemyCollections(contractIds: string[]): Promise<Map<string, CollectionSnapshot>> {
  const result = new Map<string, CollectionSnapshot>();

  for (const contract of [...new Set(contractIds)].filter(Boolean)) {
    const contractUrl = new URL(`${ALCHEMY_BASE_URL}/getContractMetadata`);
    contractUrl.searchParams.set("contractAddress", contract);
    const metadata = await alchemyFetch<AlchemyContractMetadata>(contractUrl.toString()).catch(() => null);
    if (!metadata) continue;

    result.set(contract.toLowerCase(), {
      id: contract,
      name: String(metadata.name ?? metadata.openseaMetadata?.collectionName ?? contract),
      image: metadata.openseaMetadata?.imageUrl ?? null,
      currentFloorNative: numberOrNull(metadata.openseaMetadata?.floorPrice),
      currentFloorUsd: null,
      volume30d: null,
      volumeAllTime: null,
      tokenCount: numberOrNull(metadata.totalSupply)
    });
  }

  return result;
}

async function fetchSalesForAddress(
  wallet: string,
  queryKey: "buyerAddress" | "sellerAddress",
  side: "buy" | "sell"
) {
  const trades: NormalizedTrade[] = [];
  let pageKey: string | null | undefined;
  let pageCount = 0;

  do {
    const url = new URL(`${ALCHEMY_BASE_URL}/getNFTSales`);
    url.searchParams.set(queryKey, wallet);
    url.searchParams.set("fromBlock", START_BLOCK);
    url.searchParams.set("order", "asc");
    url.searchParams.set("limit", "100");
    if (pageKey) url.searchParams.set("pageKey", pageKey);

    const payload = await alchemyFetch<AlchemySalesResponse>(url.toString());
    pageKey = payload.pageKey;
    pageCount += 1;

    const normalized = await Promise.all(
      (payload.nftSales ?? []).map(async (sale) => {
        const metadata = await fetchNftMetadata(sale.contractAddress, sale.tokenId).catch(() => null);
        const nativePrice = weiToNative(sale.sellerFee?.amount);
        if (nativePrice == null) return null;

        return {
          side,
          txHash: String(sale.transactionHash ?? ""),
          contract: String(sale.contractAddress ?? "").toLowerCase(),
          tokenId: String(sale.tokenId ?? ""),
          collectionId: String(sale.contractAddress ?? "").toLowerCase(),
          collectionName: String(
            metadata?.contract?.name ??
            metadata?.contract?.openseaMetadata?.collectionName ??
            "Unknown Collection"
          ),
          tokenName: String(
            metadata?.name ??
            metadata?.title ??
            `${metadata?.contract?.name ?? "Token"} #${sale.tokenId ?? ""}`
          ),
          image:
            metadata?.image?.cachedUrl ??
            metadata?.image?.thumbnailUrl ??
            metadata?.image?.pngUrl ??
            metadata?.image?.originalUrl ??
            null,
          timestamp: blockNumberToPseudoTimestamp(sale.blockNumber),
          priceNative: nativePrice,
          priceUsd: null,
          currencySymbol: String(sale.sellerFee?.symbol ?? "ETH"),
          fromAddress: String(sale.sellerAddress ?? "").toLowerCase(),
          toAddress: String(sale.buyerAddress ?? "").toLowerCase()
        } satisfies NormalizedTrade;
      })
    );

    trades.push(...normalized.filter(Boolean) as NormalizedTrade[]);
  } while (pageKey && pageCount < MAX_SALES_PAGES);

  return trades;
}

async function fetchNftMetadata(contractAddress: string, tokenId: string) {
  const url = new URL(`${ALCHEMY_BASE_URL}/getNFTMetadata`);
  url.searchParams.set("contractAddress", contractAddress);
  url.searchParams.set("tokenId", tokenId);
  return alchemyFetch<AlchemyNftMetadata>(url.toString());
}

async function alchemyFetch<T>(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Alchemy request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

function weiToNative(value: string | undefined) {
  if (!value) return null;
  return Number(value) / 1e18;
}

function toTimestamp(value: string | undefined) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? Math.floor(timestamp / 1000) : null;
}

function decimalTokenId(value: string | undefined) {
  if (!value) return "";
  if (value.startsWith("0x")) return BigInt(value).toString(10);
  return value;
}

function numberOrNull(value: unknown) {
  if (value == null || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function blockNumberToPseudoTimestamp(blockNumber: number | string | undefined) {
  const block = typeof blockNumber === "number" ? blockNumber : Number(blockNumber ?? 0);
  if (!Number.isFinite(block) || block <= 0) return 0;
  const currentBlock = 22000000;
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const secondsAgo = Math.max(currentBlock - block, 0) * 12;
  return currentTimestamp - secondsAgo;
}
