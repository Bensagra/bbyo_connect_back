import { Role, UserStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { ok, fail } from "../../common/api-response";
import { asyncHandler } from "../../common/async-handler";
import { writeAuditLog } from "../../common/audit";
import { requireAuth } from "../../middlewares/auth";
import { allowRoles } from "../../middlewares/rbac";
import { validateBody, validateParams } from "../../middlewares/validate";
import { prisma } from "../../lib/prisma";

const chapterApprovalsRouter = Router();

const requestSchema = z.object({
  notes: z.string().max(1000).optional(),
});

const decisionSchema = z.object({
  notes: z.string().max(1000).optional(),
});

const idParamsSchema = z.object({
  id: z.string().min(1),
});

chapterApprovalsRouter.post(
  "/request",
  requireAuth,
  validateBody(requestSchema),
  asyncHandler(async (req, res) => {
    const actor = req.authUser;
    if (!actor) {
      return fail(res, 401, "AUTH_REQUIRED", "Authentication is required");
    }

    if (actor.role !== Role.chapter_pending && actor.role !== Role.chapter_verified) {
      return fail(res, 403, "REQUEST_NOT_ALLOWED", "Only chapter accounts can request chapter approval");
    }

    const pending = await prisma.chapterApprovalRequest.findFirst({
      where: {
        chapterUserId: actor.id,
        status: "pending",
        deletedAt: null,
      },
    });

    if (pending) {
      return fail(res, 409, "REQUEST_ALREADY_PENDING", "There is already a pending approval request");
    }

    const body = req.body as z.infer<typeof requestSchema>;
    const request = await prisma.chapterApprovalRequest.create({
      data: {
        chapterUserId: actor.id,
        status: "pending",
        notes: body.notes,
      },
    });

    await writeAuditLog({
      actorId: actor.id,
      action: "chapter_approval.requested",
      entityType: "ChapterApprovalRequest",
      entityId: request.id,
    });

    return ok(res, request, undefined, 201);
  }),
);

chapterApprovalsRouter.patch(
  "/:id/approve",
  requireAuth,
  allowRoles([Role.advisor, Role.moderator, Role.regional_admin, Role.global_admin]),
  validateParams(idParamsSchema),
  validateBody(decisionSchema),
  asyncHandler(async (req, res) => {
    const actor = req.authUser!;
    const { id } = req.params as z.infer<typeof idParamsSchema>;
    const body = req.body as z.infer<typeof decisionSchema>;

    const request = await prisma.chapterApprovalRequest.findUnique({
      where: { id },
    });

    if (!request || request.deletedAt) {
      return fail(res, 404, "APPROVAL_REQUEST_NOT_FOUND", "Approval request not found");
    }

    if (request.status !== "pending") {
      return fail(res, 409, "REQUEST_ALREADY_DECIDED", "Approval request was already decided");
    }

    const approved = await prisma.chapterApprovalRequest.update({
      where: { id },
      data: {
        reviewerId: actor.id,
        status: "approved",
        notes: body.notes,
        decidedAt: new Date(),
      },
    });

    await prisma.user.update({
      where: { id: request.chapterUserId },
      data: {
        role: Role.chapter_verified,
        status: UserStatus.active,
      },
    });

    await prisma.notification.create({
      data: {
        userId: request.chapterUserId,
        type: "approval",
        title: "Chapter account approved",
        body: "Your chapter account is now verified.",
      },
    });

    await writeAuditLog({
      actorId: actor.id,
      action: "chapter_approval.approved",
      entityType: "ChapterApprovalRequest",
      entityId: approved.id,
    });

    return ok(res, approved);
  }),
);

chapterApprovalsRouter.patch(
  "/:id/reject",
  requireAuth,
  allowRoles([Role.advisor, Role.moderator, Role.regional_admin, Role.global_admin]),
  validateParams(idParamsSchema),
  validateBody(decisionSchema),
  asyncHandler(async (req, res) => {
    const actor = req.authUser!;
    const { id } = req.params as z.infer<typeof idParamsSchema>;
    const body = req.body as z.infer<typeof decisionSchema>;

    const request = await prisma.chapterApprovalRequest.findUnique({ where: { id } });
    if (!request || request.deletedAt) {
      return fail(res, 404, "APPROVAL_REQUEST_NOT_FOUND", "Approval request not found");
    }

    if (request.status !== "pending") {
      return fail(res, 409, "REQUEST_ALREADY_DECIDED", "Approval request was already decided");
    }

    const rejected = await prisma.chapterApprovalRequest.update({
      where: { id },
      data: {
        reviewerId: actor.id,
        status: "rejected",
        notes: body.notes,
        decidedAt: new Date(),
      },
    });

    await prisma.user.update({
      where: { id: request.chapterUserId },
      data: {
        role: Role.chapter_pending,
        status: UserStatus.pending,
      },
    });

    await prisma.notification.create({
      data: {
        userId: request.chapterUserId,
        type: "approval",
        title: "Chapter account not approved yet",
        body: "Your chapter request was rejected. Check notes and resubmit.",
      },
    });

    await writeAuditLog({
      actorId: actor.id,
      action: "chapter_approval.rejected",
      entityType: "ChapterApprovalRequest",
      entityId: rejected.id,
      metadataJson: { notes: body.notes ?? null },
    });

    return ok(res, rejected);
  }),
);

export { chapterApprovalsRouter };
