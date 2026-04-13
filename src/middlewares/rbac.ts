import { Role } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import { fail } from "../common/api-response";

export function allowRoles(roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      return fail(res, 401, "AUTH_REQUIRED", "Authentication is required");
    }
    if (!roles.includes(req.authUser.role)) {
      return fail(res, 403, "FORBIDDEN", "You do not have permission for this action");
    }
    return next();
  };
}

export function denyRoles(roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      return fail(res, 401, "AUTH_REQUIRED", "Authentication is required");
    }
    if (roles.includes(req.authUser.role)) {
      return fail(res, 403, "ROLE_RESTRICTED", "Your role cannot perform this action");
    }
    return next();
  };
}
