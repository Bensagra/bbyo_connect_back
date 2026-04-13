import { NextFunction, Request, Response } from "express";
import { ZodError, ZodSchema, ZodTypeAny } from "zod";
import { fail } from "../common/api-response";

function formatZodError(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
    code: issue.code,
  }));
}

export function validateBody<T extends ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        return fail(res, 400, "VALIDATION_ERROR", "Invalid request body", formatZodError(error));
      }
      return fail(res, 400, "VALIDATION_ERROR", "Invalid request body");
    }
  };
}

export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req.query);
      const mutableQuery = req.query as Record<string, unknown>;

      if (mutableQuery && typeof mutableQuery === "object") {
        for (const key of Object.keys(mutableQuery)) {
          delete mutableQuery[key];
        }
        if (parsed && typeof parsed === "object") {
          Object.assign(mutableQuery, parsed as Record<string, unknown>);
        }
      }

      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        return fail(res, 400, "VALIDATION_ERROR", "Invalid query params", formatZodError(error));
      }
      return fail(res, 400, "VALIDATION_ERROR", "Invalid query params");
    }
  };
}

export function validateParams<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.params = schema.parse(req.params) as Request["params"];
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        return fail(res, 400, "VALIDATION_ERROR", "Invalid route params", formatZodError(error));
      }
      return fail(res, 400, "VALIDATION_ERROR", "Invalid route params");
    }
  };
}
