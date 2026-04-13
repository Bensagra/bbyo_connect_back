import { Role } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { ok, fail } from "../../common/api-response";
import { asyncHandler } from "../../common/async-handler";
import { canModerate } from "../../common/permissions";
import { requireAuth } from "../../middlewares/auth";
import { denyRoles } from "../../middlewares/rbac";
import { validateBody, validateParams } from "../../middlewares/validate";
import { prisma } from "../../lib/prisma";

const storiesRouter = Router();

const createStorySchema = z.object({
  mediaUrl: z.string().url(),
  expiresInHours: z.number().int().min(1).max(48).default(24),
});

const storyIdSchema = z.object({
  storyId: z.string().min(1),
});

storiesRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const stories = await prisma.story.findMany({
      where: {
        deletedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        author: {
          select: {
            memberId: true,
            teenProfile: {
              select: {
                fullName: true,
                avatarUrl: true,
              },
            },
            chapterProfile: {
              select: {
                displayName: true,
              },
            },
          },
        },
        views: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return ok(res, stories);
  }),
);

storiesRouter.post(
  "/",
  requireAuth,
  denyRoles([Role.guest, Role.teen_pending, Role.chapter_pending]),
  validateBody(createStorySchema),
  asyncHandler(async (req, res) => {
    const actor = req.authUser!;
    const body = req.body as z.infer<typeof createStorySchema>;
    const expiresAt = new Date(Date.now() + body.expiresInHours * 60 * 60 * 1000);

    const story = await prisma.story.create({
      data: {
        authorId: actor.id,
        mediaUrl: body.mediaUrl,
        expiresAt,
      },
      include: {
        author: {
          select: {
            memberId: true,
            teenProfile: {
              select: {
                fullName: true,
                avatarUrl: true,
              },
            },
            chapterProfile: {
              select: {
                displayName: true,
              },
            },
          },
        },
      },
    });

    return ok(res, story, undefined, 201);
  }),
);

storiesRouter.delete(
  "/:storyId",
  requireAuth,
  validateParams(storyIdSchema),
  asyncHandler(async (req, res) => {
    const actor = req.authUser!;
    const { storyId } = req.params as z.infer<typeof storyIdSchema>;

    const story = await prisma.story.findUnique({ where: { id: storyId } });
    if (!story || story.deletedAt) {
      return fail(res, 404, "STORY_NOT_FOUND", "Story not found");
    }

    if (story.authorId !== actor.id && !canModerate(actor.role)) {
      return fail(res, 403, "FORBIDDEN", "Only author or moderator can delete story");
    }

    await prisma.story.update({
      where: { id: storyId },
      data: { deletedAt: new Date() },
    });

    return ok(res, { deleted: true });
  }),
);

export { storiesRouter };
