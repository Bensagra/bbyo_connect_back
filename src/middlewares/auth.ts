import { NextFunction, Request, Response } from "express";
import { fail } from "../common/api-response";
import { verifyAccessToken } from "../common/tokens";
import { prisma } from "../lib/prisma";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return fail(res, 401, "AUTH_REQUIRED", "Authentication is required");
  }

  const token = authHeader.slice("Bearer ".length).trim();
  try {
    const claims = verifyAccessToken(token);
    const user = await prisma.user.findFirst({
      where: {
        id: claims.sub,
        deletedAt: null,
      },
    });

    if (!user || user.status === "banned" || user.status === "deleted") {
      return fail(res, 401, "INVALID_SESSION", "Session is no longer valid");
    }

    req.authUser = {
      id: user.id,
      role: user.role,
      status: user.status,
    };
    return next();
  } catch {
    return fail(res, 401, "INVALID_TOKEN", "Token is invalid or expired");
  }
}
