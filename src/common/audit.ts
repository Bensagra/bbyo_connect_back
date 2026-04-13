import { prisma } from "../lib/prisma";

export async function writeAuditLog(params: {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadataJson?: unknown;
}) {
  await prisma.auditLog.create({
    data: {
      actorId: params.actorId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      metadataJson: params.metadataJson as object | undefined,
    },
  });
}
