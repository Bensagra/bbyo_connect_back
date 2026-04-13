import { Role, UserStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { ok, fail } from "../../common/api-response";
import { asyncHandler } from "../../common/async-handler";
import { writeAuditLog } from "../../common/audit";
import { requireAuth } from "../../middlewares/auth";
import { requireIdempotencyKey, idempotencyMiddleware } from "../../middlewares/idempotency";
import { validateBody } from "../../middlewares/validate";
import { prisma } from "../../lib/prisma";

const verificationRouter = Router();

const vouchSchema = z.object({
  targetUserId: z.string().min(1),
});

verificationRouter.post(
  "/vouches",
  requireAuth,
  requireIdempotencyKey,
  idempotencyMiddleware,
  validateBody(vouchSchema),
  asyncHandler(async (req, res) => {
    const actor = req.authUser;
    if (!actor) {
      return fail(res, 401, "AUTH_REQUIRED", "Authentication is required");
    }

    if (actor.role !== Role.teen_verified || actor.status !== UserStatus.active) {
      return fail(res, 403, "VOUCH_NOT_ALLOWED", "Only active verified teens can vouch");
    }

    const body = req.body as z.infer<typeof vouchSchema>;
    if (body.targetUserId === actor.id) {
      return fail(res, 400, "SELF_VOUCH_FORBIDDEN", "You cannot vouch for yourself");
    }

    const target = await prisma.user.findUnique({
      where: { id: body.targetUserId },
    });

    if (!target || target.deletedAt) {
      return fail(res, 404, "TARGET_NOT_FOUND", "Target user not found");
    }

    if (target.role !== Role.teen_pending && target.role !== Role.teen_verified) {
      return fail(res, 400, "TARGET_ROLE_INVALID", "Target user is not eligible for teen verification");
    }

    const activeVoucher = await prisma.user.findUnique({ where: { id: actor.id } });
    if (!activeVoucher || activeVoucher.status !== UserStatus.active) {
      return fail(res, 403, "VOUCHER_INACTIVE", "Voucher account must be active");
    }

    const alreadyVouched = await prisma.verificationVouch.findFirst({
      where: {
        targetUserId: body.targetUserId,
        vouchedByUserId: actor.id,
        deletedAt: null,
      },
    });

    if (alreadyVouched) {
      return fail(res, 409, "VOUCH_ALREADY_EXISTS", "You already vouched for this user");
    }

    await prisma.verificationVouch.create({
      data: {
        targetUserId: body.targetUserId,
        vouchedByUserId: actor.id,
        status: "approved",
      },
    });

    const approvedVouches = await prisma.verificationVouch.findMany({
      where: {
        targetUserId: body.targetUserId,
        status: "approved",
        deletedAt: null,
      },
      select: { vouchedByUserId: true },
      distinct: ["vouchedByUserId"],
    });

    const verifiedCount = approvedVouches.length;
    let upgraded = false;
    if (verifiedCount >= 2 && target.role === Role.teen_pending) {
      await prisma.user.update({
        where: { id: target.id },
        data: {
          role: Role.teen_verified,
          status: UserStatus.active,
        },
      });

      await prisma.notification.create({
        data: {
          userId: target.id,
          type: "approval",
          title: "Verification complete",
          body: "You are now a verified teen member.",
        },
      });

      upgraded = true;
    }

    await writeAuditLog({
      actorId: actor.id,
      action: "verification.vouch.created",
      entityType: "VerificationVouch",
      entityId: body.targetUserId,
      metadataJson: { verifiedCount, upgraded },
    });

    return ok(res, {
      targetUserId: body.targetUserId,
      approvedVouchCount: verifiedCount,
      transitionedToVerified: upgraded,
    }, undefined, 201);
  }),
);

verificationRouter.get(
  "/status",
  requireAuth,
  asyncHandler(async (req, res) => {
    const actor = req.authUser;
    if (!actor) {
      return fail(res, 401, "AUTH_REQUIRED", "Authentication is required");
    }

    const approvedCount = await prisma.verificationVouch.count({
      where: {
        targetUserId: actor.id,
        status: "approved",
        deletedAt: null,
      },
    });

    return ok(res, {
      userId: actor.id,
      role: actor.role,
      status: actor.status,
      approvedVouchCount: approvedCount,
      isVerified: actor.role === Role.teen_verified,
      needsMoreVouches: Math.max(0, 2 - approvedCount),
    });
  }),
);

export { verificationRouter };
