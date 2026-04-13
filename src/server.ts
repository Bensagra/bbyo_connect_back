import { createServer } from "http";
import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { prisma } from "./lib/prisma";
import { getRedisClient } from "./lib/redis";
import { initSocket } from "./realtime/socket";

async function bootstrap() {
  const app = createApp();
  const server = createServer(app);
  initSocket(server);

  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.connect();
      logger.info("Redis connected");
    } catch (error) {
      logger.warn({ err: error }, "Redis unavailable, running without Redis-backed features");
    }
  }

  await prisma.$connect();
  server.listen(env.port, () => {
    logger.info({ port: env.port }, "BBYO Connect API listening");
  });

  const shutdown = async () => {
    logger.info("Shutting down API");
    await prisma.$disconnect();
    if (redis) {
      await redis.quit();
    }
    server.close(() => process.exit(0));
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

bootstrap().catch((error) => {
  logger.error({ err: error }, "Fatal bootstrap error");
  process.exit(1);
});
