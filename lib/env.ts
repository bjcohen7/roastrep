const requiredAtRuntime = [
  "ETH_RPC_URL",
  "RESERVOIR_API_KEY",
  "ANTHROPIC_API_KEY"
] as const;

export function getEnv(name: string, fallback?: string) {
  return process.env[name] ?? fallback;
}

export function requireEnv(name: (typeof requiredAtRuntime)[number]) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function hasRedisConfig() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

export function isProductionRuntime() {
  return process.env.NODE_ENV === "production";
}

export function assertProductionRedisConfig() {
  if (isProductionRuntime() && !hasRedisConfig()) {
    throw new Error("Missing required production KV configuration: KV_REST_API_URL and KV_REST_API_TOKEN.");
  }
}
