import { FollowStatus, Role, UserStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { ok, fail } from "../../common/api-response";
import { asyncHandler } from "../../common/async-handler";
import { prisma } from "../../lib/prisma";
import { requireAuth } from "../../middlewares/auth";
import { denyRoles } from "../../middlewares/rbac";
import { validateBody, validateParams, validateQuery } from "../../middlewares/validate";

const connectionsRouter = Router();

const searchDirectoryQuerySchema = z.object({
  q: z.string().trim().min(1).max(120),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const followParamsSchema = z.object({
  userId: z.string().min(1),
});

const chapterFollowParamsSchema = z.object({
  chapterId: z.string().min(1),
});

const followRequestParamsSchema = z.object({
  followId: z.string().min(1),
});

const followRequestDecisionSchema = z.object({
  action: z.enum(["accept", "reject"]),
});

const privacyBodySchema = z.object({
  isPrivate: z.boolean(),
});

connectionsRouter.get(
  "/search",
  requireAuth,
  denyRoles([Role.guest]),
  validateQuery(searchDirectoryQuerySchema),
  asyncHandler(async (req, res) => {
    const actor = req.authUser!;
    const query = req.query as unknown as z.infer<typeof searchDirectoryQuerySchema>;

    const users = await prisma.user.findMany({
      where: {
        deletedAt: null,
        status: {
          in: [UserStatus.active, UserStatus.pending, UserStatus.suspended],
        },
        role: {
          not: Role.guest,
        },
        id: {
          not: actor.id,
        },
        OR: [
          {
            memberId: {
              contains: query.q,
              mode: "insensitive",
            },
          },
          {
            email: {
              contains: query.q,
              mode: "insensitive",
            },
          },
          {
            teenProfile: {
              is: {
                fullName: {
                  contains: query.q,
                  mode: "insensitive",
                },
                deletedAt: null,
              },
            },
          },
          {
            chapterProfile: {
              is: {
                displayName: {
                  contains: query.q,
                  mode: "insensitive",
                },
                deletedAt: null,
              },
            },
          },
        ],
      },
      include: {
        teenProfile: {
          include: {
            chapter: {
              select: {
                id: true,
                name: true,
                region: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            region: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        chapterProfile: {
          include: {
            chapter: {
              include: {
                region: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: query.limit,
    });

    const followMap = new Map<string, FollowStatus>();
    if (users.length > 0) {
      const follows = await prisma.userFollow.findMany({
        where: {
          followerUserId: actor.id,
          followingUserId: {
            in: users.map((user) => user.id),
          },
          deletedAt: null,
        },
        select: {
          followingUserId: true,
          status: true,
        },
      });

      for (const follow of follows) {
        followMap.set(follow.followingUserId, follow.status);
      }
    }

    const chapters = await prisma.chapter.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        OR: [
          {
            name: {
              contains: query.q,
              mode: "insensitive",
            },
          },
          {
            city: {
              contains: query.q,
              mode: "insensitive",
            },
          },
          {
            country: {
              contains: query.q,
              mode: "insensitive",
            },
          },
          {
            region: {
              is: {
                name: {
                  contains: query.q,
                  mode: "insensitive",
                },
              },
            },
          },
        ],
      },
      include: {
        region: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
      take: query.limit,
    });

    const followedChapterIds = new Set<string>();
    if (chapters.length > 0) {
      const chapterFollows = await prisma.chapterFollow.findMany({
        where: {
          userId: actor.id,
          chapterId: {
            in: chapters.map((chapter) => chapter.id),
          },
          deletedAt: null,
        },
        select: {
          chapterId: true,
        },
      });

      for (const follow of chapterFollows) {
        followedChapterIds.add(follow.chapterId);
      }
    }

    return ok(res, {
      users: users.map((user) => {
        const teenProfile = user.teenProfile;
        const chapterProfile = user.chapterProfile;
        const followStatus = followMap.get(user.id);

        return {
          id: user.id,
          role: user.role,
          memberId: user.memberId,
          isPrivate: user.isProfilePrivate,
          displayName:
            teenProfile?.fullName ??
            chapterProfile?.displayName ??
            user.memberId,
          avatarUrl: teenProfile?.avatarUrl ?? null,
          chapterName:
            teenProfile?.chapter?.name ??
            chapterProfile?.chapter?.name ??
            null,
          regionName:
            teenProfile?.region?.name ??
            teenProfile?.chapter?.region?.name ??
            chapterProfile?.chapter?.region?.name ??
            null,
          followStatus:
            followStatus === FollowStatus.accepted
              ? "following"
              : followStatus === FollowStatus.pending
              ? "pending"
              : "none",
        };
      }),
      chapters: chapters.map((chapter) => ({
        id: chapter.id,
        name: chapter.name,
        city: chapter.city,
        country: chapter.country,
        regionId: chapter.regionId,
        regionName: chapter.region.name,
        isFollowing: followedChapterIds.has(chapter.id),
      })),
    });
  }),
);

connectionsRouter.post(
  "/chapters/:chapterId/follow",
  requireAuth,
  denyRoles([Role.guest]),
  validateParams(chapterFollowParamsSchema),
  asyncHandler(async (req, res) => {
    const actor = req.authUser!;
    const { chapterId } = req.params as z.infer<typeof chapterFollowParamsSchema>;

    const chapter = await prisma.chapter.findFirst({
      where: {
        id: chapterId,
        deletedAt: null,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!chapter) {
      return fail(res, 404, "CHAPTER_NOT_FOUND", "Chapter not found");
    }

    await prisma.chapterFollow.upsert({
      where: {
        userId_chapterId: {
          userId: actor.id,
          chapterId,
        },
      },
      create: {
        userId: actor.id,
        chapterId,
      },
      update: {
        deletedAt: null,
      },
    });

    return ok(res, {
      chapterId,
      isFollowing: true,
    });
  }),
);

connectionsRouter.delete(
  "/chapters/:chapterId/follow",
  requireAuth,
  denyRoles([Role.guest]),
  validateParams(chapterFollowParamsSchema),
  asyncHandler(async (req, res) => {
    const actor = req.authUser!;
    const { chapterId } = req.params as z.infer<typeof chapterFollowParamsSchema>;

    await prisma.chapterFollow.updateMany({
      where: {
        userId: actor.id,
        chapterId,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    return ok(res, {
      chapterId,
      isFollowing: false,
    });
  }),
);

connectionsRouter.post(
  "/users/:userId/follow",
  requireAuth,
  denyRoles([Role.guest]),
  validateParams(followParamsSchema),
  asyncHandler(async (req, res) => {
    const actor = req.authUser!;
    const { userId } = req.params as z.infer<typeof followParamsSchema>;

    if (userId === actor.id) {
      return fail(res, 400, "FOLLOW_SELF_FORBIDDEN", "You cannot follow yourself");
    }

    const target = await prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
        status: {
          not: UserStatus.deleted,
        },
      },
      select: {
        id: true,
        isProfilePrivate: true,
      },
    });

    if (!target) {
      return fail(res, 404, "USER_NOT_FOUND", "User not found");
    }

    const status = target.isProfilePrivate ? FollowStatus.pending : FollowStatus.accepted;
    const now = new Date();

    const follow = await prisma.userFollow.upsert({
      where: {
        followerUserId_followingUserId: {
          followerUserId: actor.id,
          followingUserId: userId,
        },
      },
      create: {
        followerUserId: actor.id,
        followingUserId: userId,
        status,
        acceptedAt: status === FollowStatus.accepted ? now : null,
      },
      update: {
        status,
        deletedAt: null,
        acceptedAt: status === FollowStatus.accepted ? now : null,
      },
      select: {
        id: true,
        status: true,
        followingUserId: true,
      },
    });

    return ok(
      res,
      {
        userId: follow.followingUserId,
        followStatus: follow.status === FollowStatus.accepted ? "following" : "pending",
      },
      undefined,
      201,
    );
  }),
);

connectionsRouter.delete(
  "/users/:userId/follow",
  requireAuth,
  denyRoles([Role.guest]),
  validateParams(followParamsSchema),
  asyncHandler(async (req, res) => {
    const actor = req.authUser!;
    const { userId } = req.params as z.infer<typeof followParamsSchema>;

    await prisma.userFollow.updateMany({
      where: {
        followerUserId: actor.id,
        followingUserId: userId,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    return ok(res, {
      removed: true,
      userId,
      followStatus: "none",
    });
  }),
);

connectionsRouter.get(
  "/follow-requests",
  requireAuth,
  denyRoles([Role.guest]),
  asyncHandler(async (req, res) => {
    const actor = req.authUser!;

    const requests = await prisma.userFollow.findMany({
      where: {
        followingUserId: actor.id,
        status: FollowStatus.pending,
        deletedAt: null,
      },
      include: {
        followerUser: {
          include: {
            teenProfile: {
              include: {
                chapter: {
                  include: {
                    region: {
                      select: {
                        id: true,
                        name: true,
                      },
                    },
                  },
                },
              },
            },
            chapterProfile: {
              include: {
                chapter: {
                  include: {
                    region: {
                      select: {
                        id: true,
                        name: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
    });

    return ok(
      res,
      requests.map((request) => ({
        followId: request.id,
        userId: request.followerUserId,
        requestedAt: request.createdAt,
        displayName:
          request.followerUser.teenProfile?.fullName ??
          request.followerUser.chapterProfile?.displayName ??
          request.followerUser.memberId,
        memberId: request.followerUser.memberId,
      })),
    );
  }),
);

connectionsRouter.patch(
  "/follow-requests/:followId",
  requireAuth,
  denyRoles([Role.guest]),
  validateParams(followRequestParamsSchema),
  validateBody(followRequestDecisionSchema),
  asyncHandler(async (req, res) => {
    const actor = req.authUser!;
    const { followId } = req.params as z.infer<typeof followRequestParamsSchema>;
    const body = req.body as z.infer<typeof followRequestDecisionSchema>;

    const request = await prisma.userFollow.findFirst({
      where: {
        id: followId,
        followingUserId: actor.id,
        status: FollowStatus.pending,
        deletedAt: null,
      },
    });

    if (!request) {
      return fail(res, 404, "FOLLOW_REQUEST_NOT_FOUND", "Follow request not found");
    }

    if (body.action === "accept") {
      const updated = await prisma.userFollow.update({
        where: { id: followId },
        data: {
          status: FollowStatus.accepted,
          acceptedAt: new Date(),
        },
      });

      return ok(res, {
        followId: updated.id,
        followStatus: "following",
      });
    }

    await prisma.userFollow.update({
      where: { id: followId },
      data: {
        deletedAt: new Date(),
      },
    });

    return ok(res, {
      followId,
      followStatus: "none",
    });
  }),
);

connectionsRouter.get(
  "/privacy",
  requireAuth,
  denyRoles([Role.guest]),
  asyncHandler(async (req, res) => {
    const actor = req.authUser!;
    const user = await prisma.user.findFirst({
      where: {
        id: actor.id,
        deletedAt: null,
      },
      select: {
        isProfilePrivate: true,
      },
    });

    if (!user) {
      return fail(res, 404, "USER_NOT_FOUND", "User not found");
    }

    return ok(res, {
      isPrivate: user.isProfilePrivate,
    });
  }),
);

connectionsRouter.patch(
  "/privacy",
  requireAuth,
  denyRoles([Role.guest]),
  validateBody(privacyBodySchema),
  asyncHandler(async (req, res) => {
    const actor = req.authUser!;
    const body = req.body as z.infer<typeof privacyBodySchema>;

    const updated = await prisma.user.update({
      where: {
        id: actor.id,
      },
      data: {
        isProfilePrivate: body.isPrivate,
      },
      select: {
        id: true,
        isProfilePrivate: true,
      },
    });

    return ok(res, {
      userId: updated.id,
      isPrivate: updated.isProfilePrivate,
    });
  }),
);

export { connectionsRouter };
