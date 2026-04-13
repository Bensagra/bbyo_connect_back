import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { fail } from "../common/api-response";
import { AppError } from "../common/errors";
import { logger } from "../config/logger";

export function notFoundHandler(req: Request, res: Response) {
  return fail(res, 404, "NOT_FOUND", `Route not found: ${req.method} ${req.originalUrl}`);
}

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction) {
  if (error instanceof AppError) {
    return fail(res, error.statusCode, error.code, error.message, error.details);
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return fail(res, 409, "CONFLICT", "Resource already exists", error.meta);
    }
    if (error.code === "P2025") {
      return fail(res, 404, "NOT_FOUND", "Resource not found", error.meta);
    }
  }

  logger.error({ err: error, method: req.method, url: req.originalUrl }, "Unhandled API error");
  return fail(res, 500, "INTERNAL_ERROR", "Unexpected server error");
}
