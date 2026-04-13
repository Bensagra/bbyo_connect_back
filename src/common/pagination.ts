import { z } from "zod";

export const cursorQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CursorPage = {
  cursor?: string;
  limit: number;
};

export function parseCursorPagination(input: unknown): CursorPage {
  const parsed = cursorQuerySchema.parse(input);
  return {
    cursor: parsed.cursor,
    limit: parsed.limit,
  };
}

export function buildCursorMeta<T extends { id: string }>(items: T[], requestedLimit: number) {
  const hasNextPage = items.length > requestedLimit;
  const sliced = hasNextPage ? items.slice(0, requestedLimit) : items;
  const nextCursor = hasNextPage ? sliced[sliced.length - 1]?.id : null;
  return {
    hasNextPage,
    nextCursor,
    items: sliced,
  };
}
