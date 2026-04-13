import { Role, UserStatus } from "@prisma/client";

const staffRoles: Role[] = ["advisor", "moderator", "regional_admin", "global_admin"];

export function isStaffRole(role: Role): boolean {
  return staffRoles.includes(role);
}

export function canPublishFeed(role: Role): boolean {
  return ["teen_verified", "chapter_verified", ...staffRoles].includes(role);
}

export function canUseMessaging(role: Role): boolean {
  return ["teen_verified", "chapter_verified", ...staffRoles].includes(role);
}

export function isUserActive(status: UserStatus): boolean {
  return status === "active" || status === "pending";
}

export function canModerate(role: Role): boolean {
  return ["advisor", "moderator", "regional_admin", "global_admin"].includes(role);
}
