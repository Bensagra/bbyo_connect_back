import { NextFunction, Request, Response } from "express";
import { fail } from "../common/api-response";
import { env } from "../config/env";

type CacheValue = {
  status: number;
  body: unknown;
  expiresAt: number;
};

const idempotencyCache = new Map<string, CacheValue>();

function buildCacheKey(req: Request, key: string) {
  const actor = req.authUser?.id ?? req.ip;
  return `${actor}:${req.method}:${req.originalUrl}:${key}`;
}

export function requireIdempotencyKey(req: Request, res: Response, next: NextFunction) {
  const key = req.header("Idempotency-Key");
  if (!key) {
    return fail(res, 400, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key header is required");
  }
  req.idempotencyKey = key;
  return next();
}

export function idempotencyMiddleware(req: Request, res: Response, next: NextFunction) {
  const key = req.idempotencyKey;
  if (!key) {
    return next();
  }

  const cacheKey = buildCacheKey(req, key);
  const now = Date.now();
  const existing = idempotencyCache.get(cacheKey);

  if (existing && existing.expiresAt > now) {
    return res.status(existing.status).json(existing.body);
  }

  const originalJson = res.json.bind(res);
  res.json = (body: unknown) => {
    if (res.statusCode < 500) {
      idempotencyCache.set(cacheKey, {
        status: res.statusCode,
        body,
        expiresAt: now + env.idempotencyTtlSeconds * 1000,
      });
    }
    return originalJson(body);
  };

  return next();
}
