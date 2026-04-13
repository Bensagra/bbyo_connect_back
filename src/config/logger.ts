import pino from "pino";
import { env } from "./env";

export const logger = pino({
  level: env.isProduction ? "info" : "debug",
  redact: {
    paths: ["req.headers.authorization", "req.headers.cookie", "password", "passwordHash", "token", "refreshToken"],
    censor: "[REDACTED]",
  },
});
