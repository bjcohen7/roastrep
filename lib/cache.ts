import { Redis } from "@upstash/redis";

import { hasRedisConfig } from "@/lib/env";

const memoryStore = new Map<string, { expiresAt: number; value: unknown }>();

function getRedis() {
  if (!hasRedisConfig()) return null;
  try {
    return new Redis({
      url: process.env.KV_REST_API_URL!,
      token: process.env.KV_REST_API_TOKEN!
    });
  } catch (error) {
    console.error("Failed to initialize Redis cache client.", error);
    return null;
  }
}

export async function getCachedJson<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (redis) {
    try {
      const value = await redis.get<T>(key);
      return value ?? null;
    } catch (error) {
      console.error("Redis get failed; falling back to memory cache.", error);
    }
  }

  const cached = memoryStore.get(key);
  if (!cached || cached.expiresAt < Date.now()) {
    memoryStore.delete(key);
    return null;
  }
  return cached.value as T;
}

export async function setCachedJson(key: string, value: unknown, ttlSeconds: number) {
  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(key, value, { ex: ttlSeconds });
      return;
    } catch (error) {
      console.error("Redis set failed; falling back to memory cache.", error);
    }
  }

  memoryStore.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000
  });
}

export async function consumeRateLimit(key: string, limit: number, windowSeconds: number) {
  const redis = getRedis();
  if (redis) {
    try {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, windowSeconds);
      }
      return {
        allowed: count <= limit,
        remaining: Math.max(limit - count, 0)
      };
    } catch (error) {
      console.error("Redis rate limit failed; falling back to memory limiter.", error);
    }
  }

  const current = (await getCachedJson<number>(key)) ?? 0;
  const nextValue = current + 1;
  await setCachedJson(key, nextValue, windowSeconds);
  return {
    allowed: nextValue <= limit,
    remaining: Math.max(limit - nextValue, 0)
  };
}
