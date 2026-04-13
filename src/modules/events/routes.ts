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
  regionId: z.string().optional(),
  chapterId: z.string().optional(),
});

const eventSchema = z.object({
  chapterId: z.string().optional(),
  regionId: z.string().optional(),
  title: z.string().min(3).max(200),
  description: z.string().min(3).max(4000),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  timezone: z.string().min(2).max(60),
  location: z.string().max(200).optional(),
  addressLine: z.string().max(200).optional(),
  city: z.string().max(120).optional(),
  country: z.string().max(120).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
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

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    return false;
  }

  if (event.createdByUserId === actor.id) {
    return true;
  }

  if (actor.role !== Role.chapter_verified) {
    return false;
  }

  const chapterProfile = await prisma.chapterProfile.findUnique({ where: { userId: actor.id } });
  if (!chapterProfile) {
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

    const parsedLimit = Number.parseInt(String(query.limit ?? 30), 10);
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), 100)
      : 30;
    const visibilityIn = actor.role === Role.guest ? [EventVisibility.public] : [EventVisibility.public, EventVisibility.chapter, EventVisibility.region, EventVisibility.private];

    try {
      const events = await prisma.event.findMany({
        where: {
          deletedAt: null,
          visibility: query.visibility ? query.visibility : { in: visibilityIn },
          ...(query.regionId ? { regionId: query.regionId } : {}),
          ...(query.chapterId ? { chapterId: query.chapterId } : {}),
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
    let regionId = body.regionId;

    if (body.endAt <= body.startAt) {
      return fail(res, 400, "EVENT_TIME_INVALID", "Event end time must be after start time");
    }

    if (!body.isVirtual && !body.location && !body.addressLine && (body.lat === undefined || body.lng === undefined)) {
      return fail(
        res,
        400,
        "EVENT_LOCATION_REQUIRED",
        "In-person events require a location, address, or coordinates",
      );
    }

    if (actor.role === Role.chapter_verified) {
      const chapterProfile = await prisma.chapterProfile.findUnique({ where: { userId: actor.id } });
      if (!chapterProfile) {
        return fail(res, 400, "CHAPTER_PROFILE_MISSING", "Chapter profile required to create chapter events");
      }
      chapterId = chapterProfile.chapterId;
      const chapter = await prisma.chapter.findFirst({
        where: {
          id: chapterId,
          deletedAt: null,
        },
        select: {
          regionId: true,
        },
      });

      if (!chapter) {
        return fail(res, 404, "CHAPTER_NOT_FOUND", "Chapter not found");
      }

      regionId = chapter.regionId;
    }

    if (chapterId) {
      const chapter = await prisma.chapter.findFirst({
        where: {
          id: chapterId,
          deletedAt: null,
          isActive: true,
        },
        select: {
          regionId: true,
        },
      });

      if (!chapter) {
        return fail(res, 400, "CHAPTER_NOT_FOUND", "Selected chapter is invalid");
      }

      regionId = chapter.regionId;
    }

    if (actor.role === Role.regional_admin && !regionId) {
      return fail(
        res,
        400,
        "REGION_REQUIRED",
        "Regional accounts must select a region for regional events",
      );
    }

    if (regionId) {
      const region = await prisma.region.findFirst({
        where: {
          id: regionId,
          deletedAt: null,
        },
        select: {
          id: true,
        },
      });

      if (!region) {
        return fail(res, 400, "REGION_NOT_FOUND", "Selected region is invalid");
      }
    }

    const event = await prisma.event.create({
      data: {
        chapterId,
        regionId,
        createdByUserId: actor.id,
        title: body.title,
        description: body.description,
        startAt: body.startAt,
        endAt: body.endAt,
        timezone: body.timezone,
        location: body.location ?? body.addressLine,
        addressLine: body.addressLine,
        city: body.city,
        country: body.country,
        lat: body.lat,
        lng: body.lng,
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
