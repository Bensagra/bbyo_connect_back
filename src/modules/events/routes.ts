import { EventVisibility, Role } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { ok, fail } from "../../common/api-response";
import { asyncHandler } from "../../common/async-handler";
import { canModerate } from "../../common/permissions";
import { logger } from "../../config/logger";
import { requireAuth } from "../../middlewares/auth";
import { denyRoles } from "../../middlewares/rbac";
import { validateBody, validateParams, validateQuery } from "../../middlewares/validate";
import { prisma } from "../../lib/prisma";

const eventsRouter = Router();

const listEventsQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  visibility: z.enum(["public", "chapter", "region", "private"]).optional(),
});

const eventSchema = z.object({
  chapterId: z.string().optional(),
  title: z.string().min(3).max(200),
  description: z.string().min(3).max(4000),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  timezone: z.string().min(2).max(60),
  location: z.string().max(200).optional(),
  isVirtual: z.boolean().default(false),
  visibility: z.enum(["public", "chapter", "region", "private"]),
});

const updateEventSchema = eventSchema.partial();

const idSchema = z.object({
  id: z.string().min(1),
});

const reminderSchema = z.object({
  remindAt: z.coerce.date(),
});

async function canManageEvent(actor: Express.Request["authUser"], eventId: string) {
  if (!actor) {
    return false;
  }
  if (canModerate(actor.role)) {
    return true;
  }
  if (actor.role !== Role.chapter_verified) {
    return false;
  }

  const chapterProfile = await prisma.chapterProfile.findUnique({ where: { userId: actor.id } });
  if (!chapterProfile) {
    return false;
  }

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    return false;
  }

  return event.chapterId === chapterProfile.chapterId;
}

eventsRouter.get(
  "/",
  requireAuth,
  validateQuery(listEventsQuery),
  asyncHandler(async (req, res) => {
    const actor = req.authUser!;
    const query = req.query as unknown as z.infer<typeof listEventsQuery>;

    const limit = query.limit;
    const visibilityIn = actor.role === Role.guest ? [EventVisibility.public] : [EventVisibility.public, EventVisibility.chapter, EventVisibility.region, EventVisibility.private];

    try {
      const events = await prisma.event.findMany({
        where: {
          deletedAt: null,
          visibility: query.visibility ? query.visibility : { in: visibilityIn },
        },
        orderBy: { startAt: "asc" },
        take: limit + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      });

      const hasNextPage = events.length > limit;
      const sliced = hasNextPage ? events.slice(0, limit) : events;

      return ok(res, sliced, {
        hasNextPage,
        nextCursor: hasNextPage ? sliced[sliced.length - 1]?.id : null,
      });
    } catch (error) {
      logger.error({ err: error }, "events.list failed");
      return ok(res, [], {
        hasNextPage: false,
        nextCursor: null,
        degraded: true,
      });
    }
  }),
);

eventsRouter.get(
  "/:id",
  requireAuth,
  validateParams(idSchema),
  asyncHandler(async (req, res) => {
    const actor = req.authUser!;
    const { id } = req.params as z.infer<typeof idSchema>;
    const event = await prisma.event.findFirst({
      where: { id, deletedAt: null },
      include: {
        registrations: true,
      },
    });

    if (!event) {
      return fail(res, 404, "EVENT_NOT_FOUND", "Event not found");
    }

    if (actor.role === Role.guest && event.visibility !== EventVisibility.public) {
      return fail(res, 403, "GUEST_EVENT_RESTRICTED", "Guests can only view public events");
    }

    return ok(res, event);
  }),
);

eventsRouter.post(
  "/",
  requireAuth,
  denyRoles([Role.guest, Role.teen_pending, Role.chapter_pending]),
  validateBody(eventSchema),
  asyncHandler(async (req, res) => {
    const actor = req.authUser!;
    const body = req.body as z.infer<typeof eventSchema>;

    let chapterId = body.chapterId;
    if (actor.role === Role.chapter_verified) {
      const chapterProfile = await prisma.chapterProfile.findUnique({ where: { userId: actor.id } });
      if (!chapterProfile) {
        return fail(res, 400, "CHAPTER_PROFILE_MISSING", "Chapter profile required to create chapter events");
      }
      chapterId = chapterProfile.chapterId;
    }

    const event = await prisma.event.create({
      data: {
        chapterId,
        title: body.title,
        description: body.description,
        startAt: body.startAt,
        endAt: body.endAt,
        timezone: body.timezone,
        location: body.location,
        isVirtual: body.isVirtual,
        visibility: body.visibility,
      },
    });

    return ok(res, event, undefined, 201);
  }),
);

eventsRouter.patch(
  "/:id",
  requireAuth,
  validateParams(idSchema),
  validateBody(updateEventSchema),
  asyncHandler(async (req, res) => {
    const actor = req.authUser;
    const { id } = req.params as z.infer<typeof idSchema>;

    const event = await prisma.event.findFirst({ where: { id, deletedAt: null } });
    if (!event) {
      return fail(res, 404, "EVENT_NOT_FOUND", "Event not found");
    }

    const canManage = await canManageEvent(actor, id);
    if (!canManage) {
      return fail(res, 403, "FORBIDDEN", "You cannot modify this event");
    }

    const body = req.body as z.infer<typeof updateEventSchema>;
    const updated = await prisma.event.update({
      where: { id },
      data: {
        ...body,
      },
    });

    return ok(res, updated);
  }),
);

eventsRouter.delete(
  "/:id",
  requireAuth,
  validateParams(idSchema),
  asyncHandler(async (req, res) => {
    const actor = req.authUser;
    const { id } = req.params as z.infer<typeof idSchema>;

    const event = await prisma.event.findFirst({ where: { id, deletedAt: null } });
    if (!event) {
      return fail(res, 404, "EVENT_NOT_FOUND", "Event not found");
    }

    const canManage = await canManageEvent(actor, id);
    if (!canManage) {
      return fail(res, 403, "FORBIDDEN", "You cannot delete this event");
    }

    await prisma.event.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return ok(res, { deleted: true });
  }),
);

eventsRouter.post(
  "/:id/register",
  requireAuth,
  validateParams(idSchema),
  asyncHandler(async (req, res) => {
    const actor = req.authUser!;
    const { id } = req.params as z.infer<typeof idSchema>;
    const event = await prisma.event.findFirst({ where: { id, deletedAt: null } });

    if (!event) {
      return fail(res, 404, "EVENT_NOT_FOUND", "Event not found");
    }

    if (actor.role === Role.guest && event.visibility !== EventVisibility.public) {
      return fail(res, 403, "GUEST_EVENT_RESTRICTED", "Guests can only register for public events");
    }

    const registration = await prisma.eventRegistration.upsert({
      where: {
        eventId_userId: {
          eventId: id,
          userId: actor.id,
        },
      },
      create: {
        eventId: id,
        userId: actor.id,
        status: "registered",
      },
      update: {
        status: "registered",
        deletedAt: null,
      },
    });

    return ok(res, registration, undefined, 201);
  }),
);

eventsRouter.delete(
  "/:id/register",
  requireAuth,
  validateParams(idSchema),
  asyncHandler(async (req, res) => {
    const actor = req.authUser!;
    const { id } = req.params as z.infer<typeof idSchema>;

    await prisma.eventRegistration.updateMany({
      where: {
        eventId: id,
        userId: actor.id,
        deletedAt: null,
      },
      data: {
        status: "canceled",
        deletedAt: new Date(),
      },
    });

    return ok(res, { removed: true });
  }),
);

eventsRouter.post(
  "/:id/reminders",
  requireAuth,
  validateParams(idSchema),
  validateBody(reminderSchema),
  asyncHandler(async (req, res) => {
    const actor = req.authUser!;
    const { id } = req.params as z.infer<typeof idSchema>;
    const body = req.body as z.infer<typeof reminderSchema>;

    const exists = await prisma.event.findFirst({ where: { id, deletedAt: null } });
    if (!exists) {
      return fail(res, 404, "EVENT_NOT_FOUND", "Event not found");
    }

    const reminder = await prisma.eventReminder.create({
      data: {
        eventId: id,
        userId: actor.id,
        remindAt: body.remindAt,
      },
    });

    return ok(res, reminder, undefined, 201);
  }),
);

export { eventsRouter };
