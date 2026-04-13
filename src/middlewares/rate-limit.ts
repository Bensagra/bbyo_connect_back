import { NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { fail } from "../common/api-response";
import { env } from "../config/env";

const userRateWindow = new Map<string, { resetAt: number; count: number }>();

export const ipRateLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  limit: env.rateLimitMaxIp,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => fail(res, 429, "RATE_LIMIT_IP", `Too many requests from IP ${req.ip}`),
});

export function userRateLimiter(req: Request, res: Response, next: NextFunction) {
  if (!req.authUser) {
    return next();
  }

  const key = req.authUser.id;
  const now = Date.now();
  const current = userRateWindow.get(key);

  if (!current || now > current.resetAt) {
    userRateWindow.set(key, {
      resetAt: now + env.rateLimitWindowMs,
      count: 1,
    });
    return next();
  }

  current.count += 1;
  if (current.count > env.rateLimitMaxUser) {
    return fail(res, 429, "RATE_LIMIT_USER", "Too many requests for this user");
  }

  return next();
}
