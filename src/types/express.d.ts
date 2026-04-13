import { Role, UserStatus } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      authUser?: {
        id: string;
        role: Role;
        status: UserStatus;
      };
      idempotencyKey?: string;
    }
  }
}

export {};
