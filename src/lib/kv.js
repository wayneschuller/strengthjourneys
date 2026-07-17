/*
 * Shared Redis client for operational metadata and lightweight app features.
 * It accepts both legacy Vercel KV and current Upstash environment variables.
 */
import { Redis } from "@upstash/redis";

export const kv = new Redis({
  url:
    process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token:
    process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});
