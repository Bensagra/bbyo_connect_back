import { Prisma, ReactionType, Role, Visibility } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { ok, fail } from "../../common/api-response";
import { asyncHandler } from "../../common/async-handler";
import { buildCursorMeta, parseCursorPagination } from "../../common/pagination";
import { canPublishFeed, canModerate } from "../../common/permissions";
import { findBlockedWord } from "../../common/safety";
import { requireAuth } from "../../middlewares/auth";
import { denyRoles } from "../../middlewares/rbac";
import { validateBody, validateParams, validateQuery } from "../../middlewares/validate";
import { prisma } from "../../lib/prisma";

const feedRouter = Router();

const postSchema = z.object({
  category: z.enum(["general", "chapter_update", "event", "leadership", "creative", "safety"]),
  text: z.string().min(1).max(4000),
  language: z.enum(["en", "es", "he", "fr"]),
  visibility: z.enum(["public", "chapter", "region", "global", "private"]),
  media: z
    .array(
      z.object({
        type: z.enum(["image", "video", "audio", "voice_note", "file"]),
        url: z.string().url(),
        thumbnailUrl: z.string().url().optional(),
        duration: z.number().int().positive().optional(),
      }),
    )
    .max(10)
    .default([]),
});

const updatePostSchema = z.object({
  text: z.string().min(1).max(4000).optional(),
  category: z.enum(["general", "chapter_update", "event", "leadership", "creative", "safety"]).optional(),
  visibility: z.enum(["public", "chapter", "region", "global", "private"]).optional(),
});

const postIdSchema = z.object({
  postId: z.string().min(1),
});

const feedQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  category: z.enum(["general", "chapter_update", "event", "leadership", "creative", "safety"]).optional(),
});

const reactionSchema = z.object({
  reactionType: z.enum(["like", "love", "support", "clap", "celebrate", "fire"]),
});

const commentSchema = z.object({
  text: z.string().min(1).max(2000),
  language: z.enum(["en", "es", "he", "fr"]),
});

feedRouter.get(
  "/",
  requireAuth,
  validateQuery(feedQuerySchema),
  asyncHandler(async (req, res) => {
    const actor = req.authUser!;
    const query = req.query as unknown as z.infer<typeof feedQuerySchema>;
    const { cursor, limit } = parseCursorPagination(query);

    const visibilityFilter: Visibility[] = actor.role === Role.guest ? [Visibility.public] : [Visibility.public, Visibility.chapter, Visibility.region, Visibility.global];

    const where: Prisma.PostWhereInput = {
      deletedAt: null,
      isHidden: false,
      visibility: { in: visibilityFilter },
      ...(query.category ? { category: query.category } : {}),
    };

    const posts = await prisma.post.findMany({
      where,
      include: {
        media: true,
        reactions: true,
        comments: {
          where: { deletedAt: null, isHidden: false },
          take: 3,
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const page = buildCursorMeta(posts, limit);
    return ok(res, page.items, {
      nextCursor: page.nextCursor,
      hasNextPage: page.hasNextPage,
    });
  }),
);

feedRouter.post(
  "/",
  requireAuth,
  denyRoles([Role.guest, Role.teen_pending, Role.chapter_pending]),
  validateBody(postSchema),
  asyncHandler(async (req, res) => {
    const actor = req.authUser!;
    if (!canPublishFeed(actor.role)) {
      return fail(res, 403, "POST_NOT_ALLOWED", "Your role cannot publish to feed");
    }

    const body = req.body as z.infer<typeof postSchema>;
    const blockedWord = findBlockedWord(body.text);
    if (blockedWord) {
      return fail(res, 422, "CONTENT_FLAGGED", "Post contains restricted language", { blockedWord });
    }

    const post = await prisma.post.create({
      data: {
        ...(actor.role === Role.chapter_verified
          ? { chapterUserId: actor.id }
          : { authorUserId: actor.id }),
        category: body.category,
        text: body.text,
        language: body.language,
        visibility: body.visibility,
        media: {
          create: body.media.map((item) => ({
            type: item.type,
            url: item.url,
            thumbnailUrl: item.thumbnailUrl,
            duration: item.duration,
          })),
        },
      },
      include: { media: true, reactions: true, comments: true },
    });

    return ok(res, post, undefined, 201);
  }),
);

feedRouter.get(
  "/:postId",
  requireAuth,
  validateParams(postIdSchema),
  asyncHandler(async (req, res) => {
    const { postId } = req.params as z.infer<typeof postIdSchema>;
    const post = await prisma.post.findFirst({
      where: {
        id: postId,
        deletedAt: null,
      },
      include: {
        media: true,
        reactions: true,
        comments: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: 50,
        },
      },
    });

    if (!post || post.isHidden) {
      return fail(res, 404, "POST_NOT_FOUND", "Post not found");
    }

    return ok(res, post);
  }),
);

feedRouter.patch(
  "/:postId",
  requireAuth,
  validateParams(postIdSchema),
  validateBody(updatePostSchema),
  asyncHandler(async (req, res) => {
    const actor = req.authUser!;
    const { postId } = req.params as z.infer<typeof postIdSchema>;
    const body = req.body as z.infer<typeof updatePostSchema>;

    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.deletedAt) {
      return fail(res, 404, "POST_NOT_FOUND", "Post not found");
    }

    const isOwner = post.authorUserId === actor.id || post.chapterUserId === actor.id;
    if (!isOwner && !canModerate(actor.role)) {
      return fail(res, 403, "FORBIDDEN", "Only author or moderator can edit post");
    }

    if (body.text) {
      const blockedWord = findBlockedWord(body.text);
      if (blockedWord) {
        return fail(res, 422, "CONTENT_FLAGGED", "Post contains restricted language", { blockedWord });
      }
    }

    const updated = await prisma.post.update({
      where: { id: postId },
      data: {
        text: body.text,
        category: body.category,
        visibility: body.visibility,
      },
      include: { media: true, reactions: true, comments: true },
    });

    return ok(res, updated);
  }),
);

feedRouter.delete(
  "/:postId",
  requireAuth,
  validateParams(postIdSchema),
  asyncHandler(async (req, res) => {
    const actor = req.authUser!;
    const { postId } = req.params as z.infer<typeof postIdSchema>;
    const post = await prisma.post.findUnique({ where: { id: postId } });

    if (!post || post.deletedAt) {
      return fail(res, 404, "POST_NOT_FOUND", "Post not found");
    }

    const isOwner = post.authorUserId === actor.id || post.chapterUserId === actor.id;
    if (!isOwner && !canModerate(actor.role)) {
      return fail(res, 403, "FORBIDDEN", "Only author or moderator can delete post");
    }

    await prisma.post.update({
      where: { id: postId },
      data: { deletedAt: new Date() },
    });

    return ok(res, { deleted: true });
  }),
);

feedRouter.post(
  "/:postId/reactions",
  requireAuth,
  denyRoles([Role.guest]),
  validateParams(postIdSchema),
  validateBody(reactionSchema),
  asyncHandler(async (req, res) => {
    const actor = req.authUser!;
    const { postId } = req.params as z.infer<typeof postIdSchema>;
    const body = req.body as z.infer<typeof reactionSchema>;

    const post = await prisma.post.findFirst({ where: { id: postId, deletedAt: null, isHidden: false } });
    if (!post) {
      return fail(res, 404, "POST_NOT_FOUND", "Post not found");
    }

    const reaction = await prisma.postReaction.upsert({
      where: {
        postId_userId: {
          postId,
          userId: actor.id,
        },
      },
      create: {
        postId,
        userId: actor.id,
        reactionType: body.reactionType as ReactionType,
      },
      update: {
        reactionType: body.reactionType as ReactionType,
        deletedAt: null,
      },
    });

    return ok(res, reaction, undefined, 201);
  }),
);

feedRouter.delete(
  "/:postId/reactions",
  requireAuth,
  denyRoles([Role.guest]),
  validateParams(postIdSchema),
  asyncHandler(async (req, res) => {
    const actor = req.authUser!;
    const { postId } = req.params as z.infer<typeof postIdSchema>;

    await prisma.postReaction.updateMany({
      where: {
        postId,
        userId: actor.id,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    return ok(res, { removed: true });
  }),
);

feedRouter.get(
  "/:postId/comments",
  requireAuth,
  validateParams(postIdSchema),
  validateQuery(z.object({ cursor: z.string().optional(), limit: z.coerce.number().int().min(1).max(100).default(30) })),
  asyncHandler(async (req, res) => {
    const { postId } = req.params as z.infer<typeof postIdSchema>;
    const query = req.query as unknown as { cursor?: string; limit: number };
    const { cursor, limit } = parseCursorPagination(query);

    const comments = await prisma.postComment.findMany({
      where: {
        postId,
        deletedAt: null,
        isHidden: false,
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const page = buildCursorMeta(comments, limit);
    return ok(res, page.items, {
      nextCursor: page.nextCursor,
      hasNextPage: page.hasNextPage,
    });
  }),
);

feedRouter.post(
  "/:postId/comments",
  requireAuth,
  denyRoles([Role.guest]),
  validateParams(postIdSchema),
  validateBody(commentSchema),
  asyncHandler(async (req, res) => {
    const actor = req.authUser!;
    const { postId } = req.params as z.infer<typeof postIdSchema>;
    const body = req.body as z.infer<typeof commentSchema>;

    const post = await prisma.post.findFirst({ where: { id: postId, deletedAt: null, isHidden: false } });
    if (!post) {
      return fail(res, 404, "POST_NOT_FOUND", "Post not found");
    }

    if (actor.role === Role.teen_pending && post.visibility === Visibility.global) {
      return fail(res, 403, "PENDING_USER_RESTRICTED", "Pending users cannot interact in global feed");
    }

    const blockedWord = findBlockedWord(body.text);
    if (blockedWord) {
      return fail(res, 422, "CONTENT_FLAGGED", "Comment contains restricted language", { blockedWord });
    }

    const comment = await prisma.postComment.create({
      data: {
        postId,
        userId: actor.id,
        text: body.text,
        language: body.language,
      },
    });

    return ok(res, comment, undefined, 201);
  }),
);

export { feedRouter };
