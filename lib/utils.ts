export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function formatUsd(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1000000) return `${sign}$${(abs / 1000000).toFixed(2)}M`;
  if (abs >= 1000) return `${sign}$${Math.round(abs).toLocaleString("en-US")}`;
  return `${sign}$${abs.toFixed(abs >= 100 ? 0 : 2)}`;
}

export function formatNative(value: number | null | undefined, symbol = "ETH") {
  if (value == null || Number.isNaN(value)) return "—";
  const decimals = value >= 100 ? 1 : value >= 1 ? 2 : 3;
  return `${stripTrailingZeros(value.toFixed(decimals))} ${symbol}`;
}

export function formatDate(timestampSeconds: number | null | undefined) {
  if (!timestampSeconds) return "—";
  return new Date(timestampSeconds * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

export function toDisplayPrice(
  native: number | null | undefined,
  usd: number | null | undefined,
  symbol = "ETH"
) {
  return {
    native: formatNative(native, symbol),
    usd: formatUsd(usd)
  };
}

export function deterministicCaseNumber(wallet: string) {
  const hash = stringHash(wallet.toLowerCase());
  const number = (Math.abs(hash) % 900000) + 100000;
  return String(number);
}

export function sha1(input: string) {
  return Math.abs(stringHash(input)).toString(16);
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function stripTrailingZeros(value: string) {
  return value.replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
}

export function clamp(num: number, min: number, max: number) {
  return Math.min(Math.max(num, min), max);
}

function stringHash(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }
  return hash;
}
