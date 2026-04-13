import Redis from "ioredis";
import { env } from "../config/env";
import { logger } from "../config/logger";

let redisClient: Redis | null = null;

export function getRedisClient(): Redis | null {
  if (!env.redisEnabled || !env.redisUrl) {
    return null;
  }

  if (!redisClient) {
    redisClient = new Redis(env.redisUrl, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
      retryStrategy: () => null,
      reconnectOnError: () => false,
    });

    // Prevent ioredis from emitting noisy unhandled error events when Redis is optional.
    redisClient.on("error", (error) => {
      logger.debug({ err: error }, "Redis client error");
    });
  }

  return redisClient;
}
