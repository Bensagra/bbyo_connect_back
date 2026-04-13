import fs from "fs";
import path from "path";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";
import swaggerUi from "swagger-ui-express";
import YAML from "js-yaml";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { errorHandler, notFoundHandler } from "./middlewares/error-handler";
import { ipRateLimiter, userRateLimiter } from "./middlewares/rate-limit";
import { authRouter } from "./modules/auth/routes";
import { verificationRouter } from "./modules/verification/routes";
import { chapterApprovalsRouter } from "./modules/chapterApprovals/routes";
import { feedRouter } from "./modules/feed/routes";
import { storiesRouter } from "./modules/stories/routes";
import { messagingRouter } from "./modules/messaging/routes";
import { eventsRouter } from "./modules/events/routes";
import { chaptersRouter } from "./modules/chapters/routes";
import { resourcesRouter } from "./modules/resources/routes";
import { gamificationRouter } from "./modules/gamification/routes";
import { reportsRouter } from "./modules/reports/routes";
import { notificationsRouter } from "./modules/notifications/routes";
import { uploadsRouter } from "./modules/uploads/routes";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || env.corsAllowlist.length === 0 || env.corsAllowlist.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error("CORS origin not allowed"));
      },
      credentials: true,
    }),
  );

  app.use(helmet());
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(ipRateLimiter);
  app.use(pinoHttp({ logger }));
  app.use(userRateLimiter);

  app.get("/", (_req, res) => {
    res.status(200).json({
      data: {
        service: "bbyo-connect-api",
        status: "ok",
        docs: "/docs",
        health: "/health",
      },
      meta: null,
      error: null,
    });
  });

  app.get("/favicon.ico", (_req, res) => {
    res.status(204).end();
  });

  app.get("/health", (_req, res) => {
    res.status(200).json({
      data: {
        service: "bbyo-connect-api",
        status: "ok",
        now: new Date().toISOString(),
      },
      meta: null,
      error: null,
    });
  });

  app.use("/auth", authRouter);
  app.use("/verification", verificationRouter);
  app.use("/chapter-approvals", chapterApprovalsRouter);
  app.use("/feed", feedRouter);
  app.use("/stories", storiesRouter);
  app.use("/messages", messagingRouter);
  app.use("/events", eventsRouter);
  app.use("/chapters", chaptersRouter);
  app.use("/resources", resourcesRouter);
  app.use("/gamification", gamificationRouter);
  app.use("/reports", reportsRouter);
  app.use("/notifications", notificationsRouter);
  app.use("/uploads", uploadsRouter);

  try {
    const openApiPath = path.join(process.cwd(), "src/docs/openapi.yaml");
    if (fs.existsSync(openApiPath)) {
      const content = fs.readFileSync(openApiPath, "utf8");
      const document = YAML.load(content) as Record<string, unknown>;
      app.use("/docs", swaggerUi.serve, swaggerUi.setup(document));
    }
  } catch (error) {
    logger.warn({ err: error }, "Unable to load OpenAPI docs");
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

// Export a singleton app so platforms that auto-detect a module default export can run it directly.
const app = createApp();

export default app;
