import { ReportStatus, ReportTargetType } from "@prisma/client";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";

export function findBlockedWord(text: string): string | null {
  const normalized = text.toLowerCase();
  for (const word of env.bannedWords) {
    if (word && normalized.includes(word)) {
      return word;
    }
  }
  return null;
}

export async function createAutomatedRiskAlert(params: {
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  details: string;
}) {
  await prisma.report.create({
    data: {
      reporterId: params.reporterId,
      targetType: params.targetType,
      targetId: params.targetId,
      reason: params.reason,
      details: params.details,
      status: ReportStatus.open,
    },
  });
}
