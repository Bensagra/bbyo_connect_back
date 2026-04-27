import { LeaderboardPeriod, LeaderboardScope, Role } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { ok } from "../../common/api-response";
import { asyncHandler } from "../../common/async-handler";
import { requireAuth } from "../../middlewares/auth";
import { denyRoles } from "../../middlewares/rbac";
import { validateQuery } from "../../middlewares/validate";
import { prisma } from "../../lib/prisma";

const gamificationRouter = Router();

const leaderboardQuerySchema = z.object({
  scope: z.enum(["chapter", "region", "global"]).default("global"),
  period: z.enum(["weekly", "monthly", "quarterly", "yearly"]).default("weekly"),
  chapterId: z.string().optional(),
  regionId: z.string().optional(),
});

gamificationRouter.get(
  "/leaderboard",
  requireAuth,
  validateQuery(leaderboardQuerySchema),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as z.infer<typeof leaderboardQuerySchema>;

    const snapshot = await prisma.leaderboardSnapshot.findFirst({
      where: {
        scope: query.scope as LeaderboardScope,
        period: query.period as LeaderboardPeriod,
        ...(query.chapterId ? { chapterId: query.chapterId } : {}),
        ...(query.regionId ? { regionId: query.regionId } : {}),
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!snapshot) {
      return ok(res, { scope: query.scope, period: query.period, entries: [] });
    }

    return ok(res, snapshot);
  }),
);

gamificationRouter.get(
  "/me",
  requireAuth,
  denyRoles([Role.guest]),
  asyncHandler(async (req, res) => {
    const actor = req.authUser!;

    const [pointsAgg, badges, latestEntries] = await Promise.all([
      prisma.pointsLedger.aggregate({
        where: {
          userId: actor.id,
        },
        _sum: { points: true },
      }),
      prisma.userBadge.findMany({
        where: { userId: actor.id },
        include: { badge: true },
        orderBy: { awardedAt: "desc" },
      }),
      prisma.pointsLedger.findMany({
        where: { userId: actor.id },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    return ok(res, {
      userId: actor.id,
      totalPoints: pointsAgg._sum.points ?? 0,
      badges: badges.map((entry) => ({
        awardedAt: entry.awardedAt,
        badge: entry.badge,
      })),
      latestEntries,
    });
  }),
);

export { gamificationRouter };
