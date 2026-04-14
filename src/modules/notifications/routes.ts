import { Router } from "express";
import { z } from "zod";
import { ok, fail } from "../../common/api-response";
import { asyncHandler } from "../../common/async-handler";
import { requireAuth } from "../../middlewares/auth";
import { validateBody, validateParams, validateQuery } from "../../middlewares/validate";
import { prisma } from "../../lib/prisma";

const notificationsRouter = Router();

const listQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  unreadOnly: z.coerce.boolean().default(false),
});

const idParamsSchema = z.object({
  id: z.string().min(1),
});

const upsertDeviceTokenSchema = z.object({
  pushToken: z.string().min(10).max(500),
  platform: z.enum(["ios", "android", "web"]),
});

const deleteDeviceTokenSchema = z.object({
  pushToken: z.string().min(10).max(500),
});

notificationsRouter.get(
  "/",
  requireAuth,
  validateQuery(listQuerySchema),
  asyncHandler(async (req, res) => {
    const actor = req.authUser!;
    const query = req.query as unknown as z.infer<typeof listQuerySchema>;

    const notifications = await prisma.notification.findMany({
      where: {
        userId: actor.id,
        deletedAt: null,
        ...(query.unreadOnly ? { readAt: null } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });

    const hasNextPage = notifications.length > query.limit;
    const sliced = hasNextPage ? notifications.slice(0, query.limit) : notifications;

    return ok(res, sliced, {
      hasNextPage,
      nextCursor: hasNextPage ? sliced[sliced.length - 1]?.id : null,
    });
  }),
);

notificationsRouter.patch(
  "/:id/read",
  requireAuth,
  validateParams(idParamsSchema),
  asyncHandler(async (req, res) => {
    const actor = req.authUser!;
    const { id } = req.params as z.infer<typeof idParamsSchema>;

    const notification = await prisma.notification.findFirst({
      where: {
        id,
        userId: actor.id,
        deletedAt: null,
      },
    });

    if (!notification) {
      return fail(res, 404, "NOTIFICATION_NOT_FOUND", "Notification not found");
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: {
        readAt: new Date(),
      },
    });

    return ok(res, updated);
  }),
);

notificationsRouter.post(
  "/device-token",
  requireAuth,
  validateBody(upsertDeviceTokenSchema),
  asyncHandler(async (req, res) => {
    const actor = req.authUser!;
    const body = req.body as z.infer<typeof upsertDeviceTokenSchema>;

    const normalizedToken = body.pushToken.trim();

    const existing = await prisma.deviceToken.findFirst({
      where: {
        pushToken: normalizedToken,
      },
      select: {
        id: true,
        userId: true,
      },
    });

    if (existing && existing.userId !== actor.id) {
      await prisma.deviceToken.update({
        where: { id: existing.id },
        data: {
          userId: actor.id,
          platform: body.platform,
          deletedAt: null,
        },
      });
    } else if (existing) {
      await prisma.deviceToken.update({
        where: { id: existing.id },
        data: {
          platform: body.platform,
          deletedAt: null,
        },
      });
    } else {
      await prisma.deviceToken.create({
        data: {
          userId: actor.id,
          platform: body.platform,
          pushToken: normalizedToken,
        },
      });
    }

    return ok(res, {
      pushToken: normalizedToken,
      platform: body.platform,
    });
  }),
);

notificationsRouter.delete(
  "/device-token",
  requireAuth,
  validateBody(deleteDeviceTokenSchema),
  asyncHandler(async (req, res) => {
    const actor = req.authUser!;
    const body = req.body as z.infer<typeof deleteDeviceTokenSchema>;

    const normalizedToken = body.pushToken.trim();

    await prisma.deviceToken.updateMany({
      where: {
        userId: actor.id,
        pushToken: normalizedToken,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    return ok(res, {
      pushToken: normalizedToken,
      removed: true,
    });
  }),
);

export { notificationsRouter };
