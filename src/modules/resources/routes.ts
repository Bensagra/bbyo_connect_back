import { Role, Visibility } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { ok, fail } from "../../common/api-response";
import { asyncHandler } from "../../common/async-handler";
import { logger } from "../../config/logger";
import { requireAuth } from "../../middlewares/auth";
import { allowRoles } from "../../middlewares/rbac";
import { validateBody, validateQuery } from "../../middlewares/validate";
import { prisma } from "../../lib/prisma";

const resourcesRouter = Router();

const listResourcesQuery = z.object({
  language: z.enum(["en", "es", "he", "fr"]).optional(),
  visibility: z.enum(["public", "chapter", "region", "global", "private"]).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const createResourceSchema = z.object({
  title: z.string().min(3).max(200),
  type: z.enum(["article", "video", "podcast", "toolkit", "pdf", "link"]),
  language: z.enum(["en", "es", "he", "fr"]),
  url: z.string().url(),
  visibility: z.enum(["public", "chapter", "region", "global", "private"]),
});

resourcesRouter.get(
  "/",
  requireAuth,
  validateQuery(listResourcesQuery),
  asyncHandler(async (req, res) => {
    const actor = req.authUser!;
    const query = req.query as unknown as z.infer<typeof listResourcesQuery>;
    const parsedLimit = Number.parseInt(String(query.limit ?? 50), 10);
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), 100)
      : 50;

    const visibilityConstraint = actor.role === Role.guest ? { in: [Visibility.public, Visibility.global] } : query.visibility ? query.visibility : undefined;

    try {
      const resources = await prisma.resource.findMany({
        where: {
          deletedAt: null,
          ...(query.language ? { language: query.language } : {}),
          ...(visibilityConstraint ? { visibility: visibilityConstraint } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: limit + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      });

      const hasNextPage = resources.length > limit;
      const sliced = hasNextPage ? resources.slice(0, limit) : resources;

      return ok(res, sliced, {
        hasNextPage,
        nextCursor: hasNextPage ? sliced[sliced.length - 1]?.id : null,
      });
    } catch (error) {
      logger.error({ err: error }, "resources.list failed");

      // Avoid breaking Home/Profile screens if resources dataset is temporarily unavailable.
      return ok(res, [], {
        hasNextPage: false,
        nextCursor: null,
        degraded: true,
      });
    }
  }),
);

resourcesRouter.post(
  "/",
  requireAuth,
  allowRoles([Role.advisor, Role.moderator, Role.regional_admin, Role.global_admin]),
  validateBody(createResourceSchema),
  asyncHandler(async (req, res) => {
    const actor = req.authUser!;
    const body = req.body as z.infer<typeof createResourceSchema>;

    const resource = await prisma.resource.create({
      data: {
        title: body.title,
        type: body.type,
        language: body.language,
        url: body.url,
        visibility: body.visibility,
        createdBy: actor.id,
      },
    });

    return ok(res, resource, undefined, 201);
  }),
);

export { resourcesRouter };
