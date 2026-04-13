import dotenv from "dotenv";

dotenv.config({ quiet: true });

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function asNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const value = Number(raw);
  if (Number.isNaN(value)) {
    throw new Error(`Invalid numeric env var: ${name}`);
  }
  return value;
}

function asBoolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const normalized = raw.trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProduction: (process.env.NODE_ENV ?? "development") === "production",
  port: asNumber("PORT", 4000),
  databaseUrl: required("DATABASE_URL"),
  redisEnabled: asBoolean("REDIS_ENABLED", false),
  redisUrl: (process.env.REDIS_URL ?? "").trim(),
  accessTokenSecret: required("ACCESS_TOKEN_SECRET"),
  refreshTokenSecret: required("REFRESH_TOKEN_SECRET"),
  jwtIssuer: process.env.JWT_ISSUER ?? "bbyo-connect-api",
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL ?? "15m",
  refreshTokenTtlDays: asNumber("REFRESH_TOKEN_TTL_DAYS", 30),
  corsAllowlist: (process.env.CORS_ALLOWLIST ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
  idempotencyTtlSeconds: asNumber("IDEMPOTENCY_TTL_SECONDS", 300),
  rateLimitWindowMs: asNumber("RATE_LIMIT_WINDOW_MS", 60_000),
  rateLimitMaxIp: asNumber("RATE_LIMIT_MAX_IP", 120),
  rateLimitMaxUser: asNumber("RATE_LIMIT_MAX_USER", 240),
  bannedWords: (process.env.BANNED_WORDS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean),
  uploadSigningSecret: process.env.UPLOAD_SIGNING_SECRET ?? "unsafe-dev-upload-secret",
};

export type AppEnv = typeof env;
