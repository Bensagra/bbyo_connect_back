import { Response } from "express";

export type ApiErrorPayload = {
  code: string;
  message: string;
  details?: unknown;
};

export function ok<T>(res: Response, data: T, meta?: Record<string, unknown>, status = 200): Response {
  return res.status(status).json({ data, meta: meta ?? null, error: null });
}

export function fail(res: Response, status: number, code: string, message: string, details?: unknown): Response {
  const error: ApiErrorPayload = { code, message };
  if (details !== undefined) {
    error.details = details;
  }
  return res.status(status).json({ data: null, meta: null, error });
}
