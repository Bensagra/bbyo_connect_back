import Redis from "ioredis";
import { env } from "../config/env";

let redisClient: Redis | null = null;

export function getRedisClient(): Redis | null {
  if (!env.redisUrl) {
    return null;
  }
  if (!redisClient) {
    redisClient = new Redis(env.redisUrl, { maxRetriesPerRequest: 1, lazyConnect: true });
  }
  return redisClient;
}
