import argon2 from "argon2";
import { Role, UserStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { ok, fail } from "../../common/api-response";
import { asyncHandler } from "../../common/async-handler";
import { writeAuditLog } from "../../common/audit";
import { issueTokenPair, revokeRefreshToken, rotateRefreshToken } from "../../common/tokens";
import { requireAuth } from "../../middlewares/auth";
import { idempotencyMiddleware, requireIdempotencyKey } from "../../middlewares/idempotency";
import { validateBody } from "../../middlewares/validate";
import { prisma } from "../../lib/prisma";

const authRouter = Router();

const registerSchema = z.object({
  accountType: z.enum(["teen", "chapter"]),
  email: z.string().email().optional(),
  memberId: z.string().min(3).max(64),
  password: z.string().min(8).max(128),
  profile: z
    .object({
      fullName: z.string().min(2).optional(),
      pronouns: z.string().max(50).optional(),
      regionId: z.string().optional(),
      chapterId: z.string().optional(),
      avatarUrl: z.string().url().optional(),
      bio: z.string().max(500).optional(),
      languages: z.array(z.enum(["en", "es", "he", "fr"]))
        .default(["en"]),
      interests: z.array(z.string().max(64)).default([]),
      displayName: z.string().min(2).max(120).optional(),
      description: z.string().max(1000).optional(),
      location: z.string().max(160).optional(),
      advisorUserId: z.string().optional(),
    })
    .default({ languages: ["en"], interests: [] }),
});

const loginSchema = z.object({
  memberIdOrEmail: z.string().min(3),
  password: z.string().min(8),
  deviceInfo: z.record(z.string(), z.unknown()).optional(),
});

const guestSchema = z.object({
  locale: z.enum(["en", "es", "he", "fr"]).optional(),
  deviceInfo: z.record(z.string(), z.unknown()).optional(),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(20),
  deviceInfo: z.record(z.string(), z.unknown()).optional(),
});

const logoutSchema = z.object({
  refreshToken: z.string().min(20),
});

authRouter.post(
  "/register",
  requireIdempotencyKey,
  idempotencyMiddleware,
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof registerSchema>;

    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ memberId: body.memberId }, ...(body.email ? [{ email: body.email }] : [])],
      },
    });

    if (existing) {
      return fail(res, 409, "ACCOUNT_EXISTS", "A user with this memberId or email already exists");
    }

    const passwordHash = await argon2.hash(body.password);

    if (body.accountType === "teen") {
      const user = await prisma.user.create({
        data: {
          email: body.email,
          memberId: body.memberId,
          passwordHash,
          role: Role.teen_pending,
          status: UserStatus.pending,
          teenProfile: {
            create: {
              fullName: body.profile.fullName ?? "Teen Member",
              pronouns: body.profile.pronouns,
              regionId: body.profile.regionId,
              chapterId: body.profile.chapterId,
              avatarUrl: body.profile.avatarUrl,
              bio: body.profile.bio,
              languages: body.profile.languages,
              interests: body.profile.interests,
            },
          },
        },
        include: { teenProfile: true },
      });

      const tokens = await issueTokenPair(
        {
          id: user.id,
          role: user.role,
          status: user.status,
        },
        { deviceInfo: req.body.deviceInfo, ipAddress: req.ip },
      );

      await writeAuditLog({
        actorId: user.id,
        action: "auth.register.teen",
        entityType: "User",
        entityId: user.id,
      });

      return ok(
        res,
        {
          user,
          tokens,
        },
        { locale: "en" },
        201,
      );
    }

    if (!body.profile.chapterId || !body.profile.displayName) {
      return fail(res, 400, "CHAPTER_PROFILE_REQUIRED", "chapterId and displayName are required for chapter signup");
    }

    const user = await prisma.user.create({
      data: {
        email: body.email,
        memberId: body.memberId,
        passwordHash,
        role: Role.chapter_pending,
        status: UserStatus.pending,
        chapterProfile: {
          create: {
            chapterId: body.profile.chapterId,
            displayName: body.profile.displayName,
            description: body.profile.description,
            location: body.profile.location,
            advisorUserId: body.profile.advisorUserId,
          },
        },
      },
      include: { chapterProfile: true },
    });

    await prisma.chapterApprovalRequest.create({
      data: {
        chapterUserId: user.id,
        status: "pending",
      },
    });

    const tokens = await issueTokenPair(
      {
        id: user.id,
        role: user.role,
        status: user.status,
      },
      { deviceInfo: req.body.deviceInfo, ipAddress: req.ip },
    );

    await writeAuditLog({
      actorId: user.id,
      action: "auth.register.chapter",
      entityType: "User",
      entityId: user.id,
    });

    return ok(
      res,
      {
        user,
        tokens,
      },
      { locale: "en" },
      201,
    );
  }),
);

authRouter.post(
  "/login",
  requireIdempotencyKey,
  idempotencyMiddleware,
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof loginSchema>;

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ memberId: body.memberIdOrEmail }, { email: body.memberIdOrEmail }],
        deletedAt: null,
      },
    });

    if (!user || !user.passwordHash) {
      return fail(res, 401, "INVALID_CREDENTIALS", "Invalid credentials");
    }

    const passwordOk = await argon2.verify(user.passwordHash, body.password);
    if (!passwordOk) {
      return fail(res, 401, "INVALID_CREDENTIALS", "Invalid credentials");
    }

    if (["suspended", "banned", "deleted"].includes(user.status)) {
      return fail(res, 403, "ACCOUNT_RESTRICTED", "Your account is restricted");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await issueTokenPair(
      {
        id: user.id,
        role: user.role,
        status: user.status,
      },
      { deviceInfo: body.deviceInfo, ipAddress: req.ip },
    );

    await writeAuditLog({
      actorId: user.id,
      action: "auth.login",
      entityType: "User",
      entityId: user.id,
    });

    return ok(res, { user, tokens });
  }),
);

authRouter.post(
  "/guest",
  requireIdempotencyKey,
  idempotencyMiddleware,
  validateBody(guestSchema),
  asyncHandler(async (req, res) => {
    const uniqueSuffix = Math.random().toString(36).slice(2, 10).toUpperCase();
    const guest = await prisma.user.create({
      data: {
        memberId: `GUEST-${Date.now()}-${uniqueSuffix}`,
        role: Role.guest,
        status: UserStatus.active,
      },
    });

    const tokens = await issueTokenPair(
      {
        id: guest.id,
        role: guest.role,
        status: guest.status,
      },
      { deviceInfo: req.body.deviceInfo, ipAddress: req.ip },
    );

    await writeAuditLog({
      actorId: guest.id,
      action: "auth.guest",
      entityType: "User",
      entityId: guest.id,
      metadataJson: { locale: req.body.locale ?? "en" },
    });

    return ok(res, { user: guest, tokens }, { guest: true }, 201);
  }),
);

authRouter.post(
  "/refresh",
  requireIdempotencyKey,
  idempotencyMiddleware,
  validateBody(refreshSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof refreshSchema>;

    try {
      const result = await rotateRefreshToken(body.refreshToken, {
        deviceInfo: body.deviceInfo,
        ipAddress: req.ip,
      });

      return ok(res, {
        user: {
          id: result.user.id,
          role: result.user.role,
          status: result.user.status,
          memberId: result.user.memberId,
          email: result.user.email,
        },
        tokens: {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          refreshTokenExpiresAt: result.refreshTokenExpiresAt,
        },
      });
    } catch {
      return fail(res, 401, "INVALID_REFRESH_TOKEN", "Refresh token is invalid or expired");
    }
  }),
);

authRouter.post(
  "/logout",
  requireAuth,
  validateBody(logoutSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof logoutSchema>;
    await revokeRefreshToken(body.refreshToken);

    await writeAuditLog({
      actorId: req.authUser?.id,
      action: "auth.logout",
      entityType: "SessionRefreshToken",
    });

    return ok(res, { loggedOut: true });
  }),
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authUser = req.authUser;
    if (!authUser) {
      return fail(res, 401, "AUTH_REQUIRED", "Authentication is required");
    }

    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      include: {
        teenProfile: true,
        chapterProfile: true,
      },
    });

    if (!user) {
      return fail(res, 404, "USER_NOT_FOUND", "User not found");
    }

    return ok(res, user);
  }),
);

authRouter.get(
  "/export-data",
  requireAuth,
  asyncHandler(async (req, res) => {
    const actor = req.authUser;
    if (!actor) {
      return fail(res, 401, "AUTH_REQUIRED", "Authentication is required");
    }

    const [user, posts, comments, messages, reports] = await Promise.all([
      prisma.user.findUnique({
        where: { id: actor.id },
        include: {
          teenProfile: true,
          chapterProfile: true,
          deviceTokens: true,
          notifications: true,
          userBadges: {
            include: { badge: true },
          },
        },
      }),
      prisma.post.findMany({ where: { authorUserId: actor.id, deletedAt: null } }),
      prisma.postComment.findMany({ where: { userId: actor.id, deletedAt: null } }),
      prisma.message.findMany({ where: { senderId: actor.id, deletedAt: null } }),
      prisma.report.findMany({ where: { reporterId: actor.id, deletedAt: null } }),
    ]);

    return ok(res, {
      exportedAt: new Date().toISOString(),
      user,
      posts,
      comments,
      messages,
      reports,
    });
  }),
);

authRouter.delete(
  "/delete-account",
  requireAuth,
  requireIdempotencyKey,
  idempotencyMiddleware,
  asyncHandler(async (req, res) => {
    const actor = req.authUser;
    if (!actor) {
      return fail(res, 401, "AUTH_REQUIRED", "Authentication is required");
    }

    const tombstone = `deleted+${actor.id}@deleted.local`;
    await prisma.user.update({
      where: { id: actor.id },
      data: {
        status: UserStatus.deleted,
        deletedAt: new Date(),
        email: tombstone,
      },
    });

    await prisma.sessionRefreshToken.updateMany({
      where: { userId: actor.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await writeAuditLog({
      actorId: actor.id,
      action: "auth.account_deleted",
      entityType: "User",
      entityId: actor.id,
    });

    return ok(res, { deleted: true, deletedAt: new Date().toISOString() });
  }),
);

export { authRouter };
