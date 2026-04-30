import { getEnv } from "@/lib/env";
import type { GasSummary } from "@/lib/types";

type EtherscanTx = {
  hash: string;
  gasPrice: string;
  gasUsed: string;
  timeStamp: string;
};

type EtherscanResponse = {
  status: string;
  message: string;
  result: EtherscanTx[] | string;
};

export async function fetchGasSummary(wallet: string, txHashes: string[]): Promise<GasSummary> {
  const apiKey = getEnv("ETHERSCAN_API_KEY");
  if (!apiKey || txHashes.length === 0) {
    return {
      available: false,
      totalNative: 0,
      totalUsd: null,
      singleDayHighNative: 0,
      singleDayHighUsd: null,
      singleDayDate: null,
      transactionCount: 0
    };
  }

  const url = new URL("https://api.etherscan.io/api");
  url.searchParams.set("module", "account");
  url.searchParams.set("action", "txlist");
  url.searchParams.set("address", wallet);
  url.searchParams.set("startblock", "0");
  url.searchParams.set("endblock", "99999999");
  url.searchParams.set("sort", "asc");
  url.searchParams.set("apikey", apiKey);

  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Etherscan request failed (${response.status})`);
  }

  const payload = (await response.json()) as EtherscanResponse;
  if (!Array.isArray(payload.result)) {
    return {
      available: false,
      totalNative: 0,
      totalUsd: null,
      singleDayHighNative: 0,
      singleDayHighUsd: null,
      singleDayDate: null,
      transactionCount: 0
    };
  }

  const interesting = new Set(txHashes.filter(Boolean).map((hash) => hash.toLowerCase()));
  const byDay = new Map<string, number>();
  let totalWei = 0n;
  let count = 0;

  for (const tx of payload.result) {
    if (!interesting.has(tx.hash.toLowerCase())) continue;
    const gasPrice = BigInt(tx.gasPrice);
    const gasUsed = BigInt(tx.gasUsed);
    const spentWei = gasPrice * gasUsed;
    totalWei += spentWei;
    count += 1;

    const day = new Date(Number(tx.timeStamp) * 1000).toISOString().slice(0, 10);
    const current = byDay.get(day) ?? 0;
    byDay.set(day, current + Number(spentWei) / 1e18);
  }

  let singleDayDate: string | null = null;
  let singleDayHighNative = 0;
  for (const [day, value] of byDay.entries()) {
    if (value > singleDayHighNative) {
      singleDayHighNative = value;
      singleDayDate = new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
      });
    }
  }

  return {
    available: count > 0,
    totalNative: Number(totalWei) / 1e18,
    totalUsd: null,
    singleDayHighNative,
    singleDayHighUsd: null,
    singleDayDate,
    transactionCount: count
  };
}
