import { CreativeProjectStatus, Role, Visibility } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { ok, fail } from "../../common/api-response";
import { asyncHandler } from "../../common/async-handler";
import { logger } from "../../config/logger";
import { requireAuth } from "../../middlewares/auth";
import { denyRoles } from "../../middlewares/rbac";
import { validateBody, validateParams, validateQuery } from "../../middlewares/validate";
import { prisma } from "../../lib/prisma";

const chaptersRouter = Router();

const listChaptersQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  regionId: z.string().optional(),
  country: z.string().optional(),
});

const idSchema = z.object({ id: z.string().min(1) });

const travelIntroSchema = z.object({
  message: z.string().max(500).optional(),
});

chaptersRouter.get(
  "/",
  requireAuth,
  validateQuery(listChaptersQuery),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as z.infer<typeof listChaptersQuery>;
    const parsedLimit = Number.parseInt(String(query.limit ?? 50), 10);
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), 100)
      : 50;

    try {
      const chapters = await prisma.chapter.findMany({
        where: {
          deletedAt: null,
          isActive: true,
          ...(query.regionId ? { regionId: query.regionId } : {}),
          ...(query.country ? { country: query.country } : {}),
        },
        orderBy: { name: "asc" },
        take: limit + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      });

      const hasNextPage = chapters.length > limit;
      const sliced = hasNextPage ? chapters.slice(0, limit) : chapters;

      return ok(res, sliced, {
        hasNextPage,
        nextCursor: hasNextPage ? sliced[sliced.length - 1]?.id : null,
      });
    } catch (error) {
      logger.error({ err: error }, "chapters.list failed");
      return ok(res, [], {
        hasNextPage: false,
        nextCursor: null,
        degraded: true,
      });
    }
  }),
);

chaptersRouter.get(
  "/map-pins",
  requireAuth,
  asyncHandler(async (_req, res) => {
    const pins = await prisma.chapter.findMany({
      where: {
        deletedAt: null,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        city: true,
        country: true,
        lat: true,
        lng: true,
      },
    });

    return ok(res, pins);
  }),
);

chaptersRouter.get(
  "/:id",
  requireAuth,
  validateParams(idSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as z.infer<typeof idSchema>;

    const chapter = await prisma.chapter.findFirst({
      where: { id, deletedAt: null },
      include: {
        region: true,
      },
    });

    if (!chapter) {
      return fail(res, 404, "CHAPTER_NOT_FOUND", "Chapter not found");
    }

    return ok(res, chapter);
  }),
);

chaptersRouter.get(
  "/:id/board",
  requireAuth,
  validateParams(idSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as z.infer<typeof idSchema>;

    const boardPosts = await prisma.post.findMany({
      where: {
        deletedAt: null,
        isHidden: false,
        OR: [
          {
            chapterUser: {
              chapterProfile: {
                chapterId: id,
                deletedAt: null,
              },
            },
          },
          {
            authorUser: {
              teenProfile: {
                chapterId: id,
                deletedAt: null,
              },
            },
            visibility: {
              in: [Visibility.chapter, Visibility.public, Visibility.global],
            },
          },
        ],
      },
      include: {
        media: true,
        comments: {
          where: {
            deletedAt: null,
            isHidden: false,
          },
          take: 3,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return ok(res, boardPosts);
  }),
);

chaptersRouter.get(
  "/:id/projects",
  requireAuth,
  validateParams(idSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as z.infer<typeof idSchema>;

    const projects = await prisma.creativeProject.findMany({
      where: {
        chapterId: id,
        status: CreativeProjectStatus.published,
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });

    return ok(res, projects);
  }),
);

chaptersRouter.post(
  "/:id/travel-intro",
  requireAuth,
  denyRoles([Role.guest]),
  validateParams(idSchema),
  validateBody(travelIntroSchema),
  asyncHandler(async (req, res) => {
    const actor = req.authUser!;
    const { id } = req.params as z.infer<typeof idSchema>;
    const body = req.body as z.infer<typeof travelIntroSchema>;

    const chapter = await prisma.chapter.findFirst({ where: { id, deletedAt: null, isActive: true } });
    if (!chapter) {
      return fail(res, 404, "CHAPTER_NOT_FOUND", "Chapter not found");
    }

    const intro = await prisma.travelIntro.create({
      data: {
        chapterId: id,
        requesterUserId: actor.id,
        message: body.message,
      },
    });

    return ok(res, intro, undefined, 201);
  }),
);

export { chaptersRouter };
