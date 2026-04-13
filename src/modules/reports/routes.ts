import { ModerationActionType, ReportStatus, Role } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { ok, fail } from "../../common/api-response";
import { asyncHandler } from "../../common/async-handler";
import { writeAuditLog } from "../../common/audit";
import { canModerate } from "../../common/permissions";
import { requireAuth } from "../../middlewares/auth";
import { allowRoles } from "../../middlewares/rbac";
import { validateBody, validateParams, validateQuery } from "../../middlewares/validate";
import { prisma } from "../../lib/prisma";

const reportsRouter = Router();

const createReportSchema = z.object({
  targetType: z.enum(["user", "post", "comment", "story", "message", "event", "chapter"]),
  targetId: z.string().min(1),
  reason: z.string().min(3).max(300),
  details: z.string().max(2000).optional(),
});

const listReportsQuery = z.object({
  status: z.enum(["open", "under_review", "resolved", "dismissed"]).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const resolveParamsSchema = z.object({
  id: z.string().min(1),
});

const resolveBodySchema = z.object({
  status: z.enum(["resolved", "dismissed"]).default("resolved"),
  actionType: z.enum(["hide_content", "warn_user", "suspend_user", "ban_user", "restore_content", "note"]),
  notes: z.string().max(2000).optional(),
});

async function applyModerationAction(report: { targetType: string; targetId: string }, actionType: ModerationActionType) {
  if (report.targetType === "post") {
    if (actionType === ModerationActionType.hide_content) {
      await prisma.post.updateMany({ where: { id: report.targetId }, data: { isHidden: true } });
    }
    if (actionType === ModerationActionType.restore_content) {
      await prisma.post.updateMany({ where: { id: report.targetId }, data: { isHidden: false } });
    }
  }

  if (report.targetType === "comment") {
    if (actionType === ModerationActionType.hide_content) {
      await prisma.postComment.updateMany({ where: { id: report.targetId }, data: { isHidden: true } });
    }
    if (actionType === ModerationActionType.restore_content) {
      await prisma.postComment.updateMany({ where: { id: report.targetId }, data: { isHidden: false } });
    }
  }

  if (report.targetType === "story" && actionType === ModerationActionType.hide_content) {
    await prisma.story.updateMany({ where: { id: report.targetId }, data: { deletedAt: new Date() } });
  }

  if (report.targetType === "message" && actionType === ModerationActionType.hide_content) {
    await prisma.message.updateMany({ where: { id: report.targetId }, data: { deletedAt: new Date() } });
  }

  if (report.targetType === "user") {
    if (actionType === ModerationActionType.suspend_user) {
      await prisma.user.updateMany({ where: { id: report.targetId }, data: { status: "suspended" } });
    }
    if (actionType === ModerationActionType.ban_user) {
      await prisma.user.updateMany({ where: { id: report.targetId }, data: { status: "banned" } });
    }
    if (actionType === ModerationActionType.restore_content) {
      await prisma.user.updateMany({ where: { id: report.targetId }, data: { status: "active" } });
    }
  }
}

reportsRouter.post(
  "/",
  requireAuth,
  validateBody(createReportSchema),
  asyncHandler(async (req, res) => {
    const actor = req.authUser!;
    const body = req.body as z.infer<typeof createReportSchema>;

    const report = await prisma.report.create({
      data: {
        reporterId: actor.id,
        targetType: body.targetType,
        targetId: body.targetId,
        reason: body.reason,
        details: body.details,
        status: ReportStatus.open,
      },
    });

    await writeAuditLog({
      actorId: actor.id,
      action: "report.created",
      entityType: "Report",
      entityId: report.id,
      metadataJson: {
        targetType: body.targetType,
        targetId: body.targetId,
      },
    });

    return ok(res, report, undefined, 201);
  }),
);

reportsRouter.get(
  "/",
  requireAuth,
  allowRoles([Role.advisor, Role.moderator, Role.regional_admin, Role.global_admin]),
  validateQuery(listReportsQuery),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as z.infer<typeof listReportsQuery>;

    const reports = await prisma.report.findMany({
      where: {
        deletedAt: null,
        ...(query.status ? { status: query.status } : {}),
      },
      include: {
        actions: true,
      },
      orderBy: { createdAt: "desc" },
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });

    const hasNextPage = reports.length > query.limit;
    const sliced = hasNextPage ? reports.slice(0, query.limit) : reports;

    return ok(res, sliced, {
      hasNextPage,
      nextCursor: hasNextPage ? sliced[sliced.length - 1]?.id : null,
    });
  }),
);

reportsRouter.patch(
  "/:id/resolve",
  requireAuth,
  allowRoles([Role.advisor, Role.moderator, Role.regional_admin, Role.global_admin]),
  validateParams(resolveParamsSchema),
  validateBody(resolveBodySchema),
  asyncHandler(async (req, res) => {
    const actor = req.authUser!;
    if (!canModerate(actor.role)) {
      return fail(res, 403, "FORBIDDEN", "You do not have moderation privileges");
    }

    const { id } = req.params as z.infer<typeof resolveParamsSchema>;
    const body = req.body as z.infer<typeof resolveBodySchema>;

    const report = await prisma.report.findUnique({ where: { id } });
    if (!report || report.deletedAt) {
      return fail(res, 404, "REPORT_NOT_FOUND", "Report not found");
    }

    const action = await prisma.moderationAction.create({
      data: {
        reportId: id,
        moderatorId: actor.id,
        actionType: body.actionType,
        notes: body.notes,
      },
    });

    await applyModerationAction(report, body.actionType);

    const resolved = await prisma.report.update({
      where: { id },
      data: {
        status: body.status as ReportStatus,
      },
      include: {
        actions: true,
      },
    });

    await writeAuditLog({
      actorId: actor.id,
      action: "report.resolved",
      entityType: "Report",
      entityId: resolved.id,
      metadataJson: {
        actionId: action.id,
        actionType: body.actionType,
      },
    });

    return ok(res, resolved);
  }),
);

export { reportsRouter };
