import { Role, UserStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { ok, fail } from "../../common/api-response";
import { asyncHandler } from "../../common/async-handler";
import { writeAuditLog } from "../../common/audit";
import { logger } from "../../config/logger";
import { prisma } from "../../lib/prisma";
import { requireAuth } from "../../middlewares/auth";
import { allowRoles } from "../../middlewares/rbac";
import { validateBody, validateParams, validateQuery } from "../../middlewares/validate";

const adminRouter = Router();

const adminReadRoles: Role[] = [Role.advisor, Role.moderator, Role.regional_admin, Role.global_admin];
const adminWriteRoles: Role[] = [Role.moderator, Role.regional_admin, Role.global_admin];
const pendingAdmissionRoles: Role[] = [Role.teen_pending, Role.chapter_pending];
const activatableRoles: Role[] = [Role.teen_verified, Role.chapter_verified, Role.advisor, Role.moderator, Role.regional_admin, Role.global_admin];

const booleanQueryValue = z
  .union([z.boolean(), z.string()])
  .transform((value) => {
    if (typeof value === "boolean") {
      return value;
    }

    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on";
  });

const idParamsSchema = z.object({
  id: z.string().min(1),
});

const listUsersQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().min(1).max(120).optional(),
  role: z.nativeEnum(Role).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  chapterId: z.string().optional(),
  includeDeleted: booleanQueryValue.optional().default(false),
});

const listChaptersQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().min(1).max(120).optional(),
  regionId: z.string().optional(),
  country: z.string().optional(),
  isActive: booleanQueryValue.optional(),
  includeDeleted: booleanQueryValue.optional().default(false),
});

const admitUserBodySchema = z.object({
  notes: z.string().max(500).optional(),
});

const rejectUserBodySchema = z.object({
  reason: z.string().min(3).max(500),
  status: z.enum(["pending", "suspended", "banned"]).default("pending"),
});

const updateUserStatusBodySchema = z.object({
  status: z.enum(["active", "pending", "suspended", "banned"]),
  reason: z.string().max(500).optional(),
});

const updateUserRoleBodySchema = z.object({
  role: z.nativeEnum(Role),
  reason: z.string().max(500).optional(),
});

const updateChapterBodySchema = z.object({
  name: z.string().min(2).max(120).optional(),
  regionId: z.string().optional(),
  city: z.string().min(2).max(120).optional(),
  country: z.string().min(2).max(120).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  isActive: z.boolean().optional(),
});

const admitChapterBodySchema = z.object({
  notes: z.string().max(500).optional(),
});

function sanitizeUser<T extends { passwordHash?: string | null }>(user: T) {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

adminRouter.get(
  "/overview",
  requireAuth,
  allowRoles(adminReadRoles),
  asyncHandler(async (_req, res) => {
    const [
      totalUsers,
      activeUsers,
      pendingUsers,
      suspendedUsers,
      bannedUsers,
      pendingTeenAdmissions,
      pendingChapterAdmissions,
      totalChapters,
      activeChapters,
      inactiveChapters,
    ] = await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { deletedAt: null, status: UserStatus.active } }),
      prisma.user.count({ where: { deletedAt: null, status: UserStatus.pending } }),
      prisma.user.count({ where: { deletedAt: null, status: UserStatus.suspended } }),
      prisma.user.count({ where: { deletedAt: null, status: UserStatus.banned } }),
      prisma.user.count({ where: { deletedAt: null, role: Role.teen_pending, status: UserStatus.pending } }),
      prisma.user.count({ where: { deletedAt: null, role: Role.chapter_pending, status: UserStatus.pending } }),
      prisma.chapter.count({ where: { deletedAt: null } }),
      prisma.chapter.count({ where: { deletedAt: null, isActive: true } }),
      prisma.chapter.count({ where: { deletedAt: null, isActive: false } }),
    ]);

    return ok(res, {
      users: {
        total: totalUsers,
        active: activeUsers,
        pending: pendingUsers,
        suspended: suspendedUsers,
        banned: bannedUsers,
        pendingTeenAdmissions,
        pendingChapterAdmissions,
      },
      chapters: {
        total: totalChapters,
        active: activeChapters,
        inactive: inactiveChapters,
      },
    });
  }),
);

adminRouter.get(
  "/users",
  requireAuth,
  allowRoles(adminReadRoles),
  validateQuery(listUsersQuerySchema),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as z.infer<typeof listUsersQuerySchema>;
    const parsedLimit = Number.parseInt(String(query.limit ?? 50), 10);
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), 100)
      : 50;
    const andFilters: Record<string, unknown>[] = [];

    if (!query.includeDeleted) {
      andFilters.push({ deletedAt: null });
    }
    if (query.role) {
      andFilters.push({ role: query.role });
    }
    if (query.status) {
      andFilters.push({ status: query.status });
    }
    if (query.search) {
      andFilters.push({
        OR: [
          { memberId: { contains: query.search, mode: "insensitive" } },
          { email: { contains: query.search, mode: "insensitive" } },
        ],
      });
    }
    if (query.chapterId) {
      andFilters.push({
        OR: [
          { teenProfile: { is: { chapterId: query.chapterId, deletedAt: null } } },
          { chapterProfile: { is: { chapterId: query.chapterId, deletedAt: null } } },
        ],
      });
    }

    try {
      const users = await prisma.user.findMany({
        where: andFilters.length > 0 ? { AND: andFilters } : {},
        include: {
          teenProfile: {
            select: {
              fullName: true,
              chapterId: true,
              regionId: true,
              avatarUrl: true,
            },
          },
          chapterProfile: {
            select: {
              displayName: true,
              chapterId: true,
              location: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      });

      const hasNextPage = users.length > limit;
      const sliced = hasNextPage ? users.slice(0, limit) : users;

      return ok(
        res,
        sliced.map((user) => sanitizeUser(user)),
        {
          hasNextPage,
          nextCursor: hasNextPage ? sliced[sliced.length - 1]?.id ?? null : null,
        },
      );
    } catch (error) {
      logger.error({ err: error }, "admin.users.list failed");
      return ok(res, [], {
        hasNextPage: false,
        nextCursor: null,
        degraded: true,
      });
    }
  }),
);

adminRouter.get(
  "/users/:id",
  requireAuth,
  allowRoles(adminReadRoles),
  validateParams(idParamsSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as z.infer<typeof idParamsSchema>;

    const user = await prisma.user.findFirst({
      where: {
        id,
      },
      include: {
        teenProfile: {
          include: {
            chapter: true,
            region: true,
          },
        },
        chapterProfile: {
          include: {
            chapter: true,
          },
        },
      },
    });

    if (!user) {
      return fail(res, 404, "USER_NOT_FOUND", "User not found");
    }

    const activeSessionCount = await prisma.sessionRefreshToken.count({
      where: {
        userId: user.id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    return ok(res, {
      ...sanitizeUser(user),
      activeSessionCount,
    });
  }),
);

adminRouter.patch(
  "/users/:id/admit",
  requireAuth,
  allowRoles(adminWriteRoles),
  validateParams(idParamsSchema),
  validateBody(admitUserBodySchema),
  asyncHandler(async (req, res) => {
    const actor = req.authUser!;
    const { id } = req.params as z.infer<typeof idParamsSchema>;
    const body = req.body as z.infer<typeof admitUserBodySchema>;

    const target = await prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!target) {
      return fail(res, 404, "USER_NOT_FOUND", "User not found");
    }

    if (target.status === UserStatus.deleted) {
      return fail(res, 409, "USER_DELETED", "Deleted users cannot be admitted");
    }

    let nextRole = target.role;
    if (target.role === Role.teen_pending) {
      nextRole = Role.teen_verified;
    }
    if (target.role === Role.chapter_pending) {
      nextRole = Role.chapter_verified;
    }

    const admittedUser = await prisma.user.update({
      where: { id: target.id },
      data: {
        role: nextRole,
        status: UserStatus.active,
      },
    });

    let decidedRequestId: string | null = null;
    if (target.role === Role.chapter_pending) {
      const pendingRequest = await prisma.chapterApprovalRequest.findFirst({
        where: {
          chapterUserId: target.id,
          status: "pending",
          deletedAt: null,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (pendingRequest) {
        const decided = await prisma.chapterApprovalRequest.update({
          where: { id: pendingRequest.id },
          data: {
            reviewerId: actor.id,
            status: "approved",
            notes: body.notes,
            decidedAt: new Date(),
          },
        });
        decidedRequestId = decided.id;
      }
    }

    await prisma.notification.create({
      data: {
        userId: admittedUser.id,
        type: "approval",
        title: "Account admitted",
        body: "Your account was admitted from the admin panel.",
      },
    });

    await writeAuditLog({
      actorId: actor.id,
      action: "admin.user.admitted",
      entityType: "User",
      entityId: admittedUser.id,
      metadataJson: {
        previousRole: target.role,
        previousStatus: target.status,
        nextRole: admittedUser.role,
        nextStatus: admittedUser.status,
        chapterApprovalRequestId: decidedRequestId,
      },
    });

    return ok(res, {
      admitted: true,
      user: sanitizeUser(admittedUser),
      previousRole: target.role,
      previousStatus: target.status,
      chapterApprovalRequestId: decidedRequestId,
    });
  }),
);

adminRouter.patch(
  "/users/:id/reject",
  requireAuth,
  allowRoles(adminWriteRoles),
  validateParams(idParamsSchema),
  validateBody(rejectUserBodySchema),
  asyncHandler(async (req, res) => {
    const actor = req.authUser!;
    const { id } = req.params as z.infer<typeof idParamsSchema>;
    const body = req.body as z.infer<typeof rejectUserBodySchema>;

    const target = await prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!target) {
      return fail(res, 404, "USER_NOT_FOUND", "User not found");
    }

    if (!pendingAdmissionRoles.includes(target.role)) {
      return fail(res, 409, "USER_NOT_PENDING_FOR_ADMISSION", "User is not pending admission");
    }

    const rejectedUser = await prisma.user.update({
      where: { id: target.id },
      data: {
        status: body.status,
      },
    });

    let decidedRequestId: string | null = null;
    if (target.role === Role.chapter_pending) {
      const pendingRequest = await prisma.chapterApprovalRequest.findFirst({
        where: {
          chapterUserId: target.id,
          status: "pending",
          deletedAt: null,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (pendingRequest) {
        const decided = await prisma.chapterApprovalRequest.update({
          where: { id: pendingRequest.id },
          data: {
            reviewerId: actor.id,
            status: "rejected",
            notes: body.reason,
            decidedAt: new Date(),
          },
        });
        decidedRequestId = decided.id;
      }
    }

    await prisma.notification.create({
      data: {
        userId: rejectedUser.id,
        type: "approval",
        title: "Admission rejected",
        body: "Your account admission was rejected. Please contact support.",
      },
    });

    await writeAuditLog({
      actorId: actor.id,
      action: "admin.user.rejected",
      entityType: "User",
      entityId: rejectedUser.id,
      metadataJson: {
        reason: body.reason,
        nextStatus: rejectedUser.status,
        chapterApprovalRequestId: decidedRequestId,
      },
    });

    return ok(res, {
      rejected: true,
      user: sanitizeUser(rejectedUser),
      reason: body.reason,
      chapterApprovalRequestId: decidedRequestId,
    });
  }),
);

adminRouter.patch(
  "/users/:id/status",
  requireAuth,
  allowRoles(adminWriteRoles),
  validateParams(idParamsSchema),
  validateBody(updateUserStatusBodySchema),
  asyncHandler(async (req, res) => {
    const actor = req.authUser!;
    const { id } = req.params as z.infer<typeof idParamsSchema>;
    const body = req.body as z.infer<typeof updateUserStatusBodySchema>;

    const target = await prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!target) {
      return fail(res, 404, "USER_NOT_FOUND", "User not found");
    }

    if (target.role === Role.global_admin && actor.role !== Role.global_admin) {
      return fail(res, 403, "FORBIDDEN", "Only global admin can update another global admin");
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        status: body.status,
      },
    });

    await writeAuditLog({
      actorId: actor.id,
      action: "admin.user.status_updated",
      entityType: "User",
      entityId: updated.id,
      metadataJson: {
        previousStatus: target.status,
        nextStatus: updated.status,
        reason: body.reason ?? null,
      },
    });

    return ok(res, {
      user: sanitizeUser(updated),
      previousStatus: target.status,
      reason: body.reason ?? null,
    });
  }),
);

adminRouter.patch(
  "/users/:id/role",
  requireAuth,
  allowRoles([Role.global_admin]),
  validateParams(idParamsSchema),
  validateBody(updateUserRoleBodySchema),
  asyncHandler(async (req, res) => {
    const actor = req.authUser!;
    const { id } = req.params as z.infer<typeof idParamsSchema>;
    const body = req.body as z.infer<typeof updateUserRoleBodySchema>;

    const target = await prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        teenProfile: true,
        chapterProfile: true,
      },
    });

    if (!target) {
      return fail(res, 404, "USER_NOT_FOUND", "User not found");
    }

    if (target.id === actor.id && body.role !== Role.global_admin) {
      return fail(res, 403, "SELF_ROLE_CHANGE_FORBIDDEN", "Global admin cannot demote itself");
    }

    if (body.role === Role.teen_verified && !target.teenProfile) {
      return fail(res, 400, "TEEN_PROFILE_REQUIRED", "User needs a teen profile for teen roles");
    }

    if (body.role === Role.chapter_verified && !target.chapterProfile) {
      return fail(res, 400, "CHAPTER_PROFILE_REQUIRED", "User needs a chapter profile for chapter roles");
    }

    const shouldActivate = activatableRoles.includes(body.role) && target.status === UserStatus.pending;

    const updated = await prisma.user.update({
      where: { id },
      data: {
        role: body.role,
        ...(shouldActivate ? { status: UserStatus.active } : {}),
      },
    });

    await writeAuditLog({
      actorId: actor.id,
      action: "admin.user.role_updated",
      entityType: "User",
      entityId: updated.id,
      metadataJson: {
        previousRole: target.role,
        nextRole: updated.role,
        reason: body.reason ?? null,
      },
    });

    return ok(res, {
      user: sanitizeUser(updated),
      previousRole: target.role,
      reason: body.reason ?? null,
    });
  }),
);

adminRouter.get(
  "/chapters",
  requireAuth,
  allowRoles(adminReadRoles),
  validateQuery(listChaptersQuerySchema),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as z.infer<typeof listChaptersQuerySchema>;
    const parsedLimit = Number.parseInt(String(query.limit ?? 50), 10);
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), 100)
      : 50;
    const andFilters: Record<string, unknown>[] = [];

    if (!query.includeDeleted) {
      andFilters.push({ deletedAt: null });
    }
    if (query.regionId) {
      andFilters.push({ regionId: query.regionId });
    }
    if (query.country) {
      andFilters.push({ country: query.country });
    }
    if (query.isActive !== undefined) {
      andFilters.push({ isActive: query.isActive });
    }
    if (query.search) {
      andFilters.push({
        OR: [
          { name: { contains: query.search, mode: "insensitive" } },
          { city: { contains: query.search, mode: "insensitive" } },
          { country: { contains: query.search, mode: "insensitive" } },
        ],
      });
    }

    try {
      const chapters = await prisma.chapter.findMany({
        where: andFilters.length > 0 ? { AND: andFilters } : {},
        include: {
          region: true,
          _count: {
            select: {
              teenProfiles: true,
              chapterUsers: true,
              events: true,
              projects: true,
              oneTimeCodes: true,
            },
          },
        },
        orderBy: { name: "asc" },
        take: limit + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      });

      const hasNextPage = chapters.length > limit;
      const sliced = hasNextPage ? chapters.slice(0, limit) : chapters;

      return ok(res, sliced, {
        hasNextPage,
        nextCursor: hasNextPage ? sliced[sliced.length - 1]?.id ?? null : null,
      });
    } catch (error) {
      logger.error({ err: error }, "admin.chapters.list failed");
      return ok(res, [], {
        hasNextPage: false,
        nextCursor: null,
        degraded: true,
      });
    }
  }),
);

adminRouter.get(
  "/chapters/:id",
  requireAuth,
  allowRoles(adminReadRoles),
  validateParams(idParamsSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as z.infer<typeof idParamsSchema>;

    const chapter = await prisma.chapter.findFirst({
      where: {
        id,
      },
      include: {
        region: true,
        _count: {
          select: {
            teenProfiles: true,
            chapterUsers: true,
            events: true,
            projects: true,
            travelIntros: true,
            oneTimeCodes: true,
          },
        },
      },
    });

    if (!chapter) {
      return fail(res, 404, "CHAPTER_NOT_FOUND", "Chapter not found");
    }

    const pendingChapterUsers = await prisma.user.count({
      where: {
        role: Role.chapter_pending,
        status: UserStatus.pending,
        deletedAt: null,
        chapterProfile: {
          is: {
            chapterId: chapter.id,
            deletedAt: null,
          },
        },
      },
    });

    const pendingTeenUsers = await prisma.user.count({
      where: {
        role: Role.teen_pending,
        status: UserStatus.pending,
        deletedAt: null,
        teenProfile: {
          is: {
            chapterId: chapter.id,
            deletedAt: null,
          },
        },
      },
    });

    return ok(res, {
      ...chapter,
      pendingChapterUsers,
      pendingTeenUsers,
    });
  }),
);

adminRouter.patch(
  "/chapters/:id",
  requireAuth,
  allowRoles(adminWriteRoles),
  validateParams(idParamsSchema),
  validateBody(updateChapterBodySchema),
  asyncHandler(async (req, res) => {
    const actor = req.authUser!;
    const { id } = req.params as z.infer<typeof idParamsSchema>;
    const body = req.body as z.infer<typeof updateChapterBodySchema>;

    const chapter = await prisma.chapter.findFirst({ where: { id, deletedAt: null } });
    if (!chapter) {
      return fail(res, 404, "CHAPTER_NOT_FOUND", "Chapter not found");
    }

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) {
      data.name = body.name;
    }
    if (body.regionId !== undefined) {
      data.regionId = body.regionId;
    }
    if (body.city !== undefined) {
      data.city = body.city;
    }
    if (body.country !== undefined) {
      data.country = body.country;
    }
    if (body.lat !== undefined) {
      data.lat = body.lat;
    }
    if (body.lng !== undefined) {
      data.lng = body.lng;
    }
    if (body.isActive !== undefined) {
      data.isActive = body.isActive;
    }

    if (Object.keys(data).length === 0) {
      return fail(res, 400, "NOTHING_TO_UPDATE", "At least one field is required to update chapter");
    }

    const updated = await prisma.chapter.update({
      where: { id },
      data,
      include: {
        region: true,
      },
    });

    await writeAuditLog({
      actorId: actor.id,
      action: "admin.chapter.updated",
      entityType: "Chapter",
      entityId: updated.id,
      metadataJson: {
        changedFields: Object.keys(data),
      },
    });

    return ok(res, updated);
  }),
);

adminRouter.patch(
  "/chapters/:id/admit",
  requireAuth,
  allowRoles(adminWriteRoles),
  validateParams(idParamsSchema),
  validateBody(admitChapterBodySchema),
  asyncHandler(async (req, res) => {
    const actor = req.authUser!;
    const { id } = req.params as z.infer<typeof idParamsSchema>;

    const chapter = await prisma.chapter.findFirst({ where: { id, deletedAt: null } });
    if (!chapter) {
      return fail(res, 404, "CHAPTER_NOT_FOUND", "Chapter not found");
    }

    const admitted = await prisma.chapter.update({
      where: { id },
      data: {
        isActive: true,
      },
    });

    await writeAuditLog({
      actorId: actor.id,
      action: "admin.chapter.admitted",
      entityType: "Chapter",
      entityId: admitted.id,
    });

    return ok(res, {
      admitted: true,
      chapter: admitted,
    });
  }),
);

export { adminRouter };