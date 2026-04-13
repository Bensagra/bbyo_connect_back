import jwt from "jsonwebtoken";
import request from "supertest";
import { Role, UserStatus } from "@prisma/client";
import { env } from "../../src/config/env";
import { createApp } from "../../src/app";

jest.mock("../../src/lib/prisma", () => ({
  prisma: require("../fixtures/prismaMock").prismaMock,
}));

const { prismaMock, resetPrismaMock } = require("../fixtures/prismaMock") as {
  prismaMock: any;
  resetPrismaMock: () => void;
};

function tokenFor(user: { id: string; role: Role; status: UserStatus }) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      status: user.status,
    },
    env.accessTokenSecret,
    {
      issuer: env.jwtIssuer,
      expiresIn: "15m",
    },
  );
}

describe("Critical flow: teen register + 2 vouches", () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  it("registers teen as pending", async () => {
    const app = createApp();

    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({
      id: "teen-pending-1",
      email: "newteen@bbyo.org",
      memberId: "TEEN-900",
      role: Role.teen_pending,
      status: UserStatus.pending,
      teenProfile: { userId: "teen-pending-1", fullName: "New Teen" },
    });
    prismaMock.sessionRefreshToken.create.mockResolvedValue({ id: "session-1" });
    prismaMock.auditLog.create.mockResolvedValue({ id: "audit-1" });

    const response = await request(app)
      .post("/auth/register")
      .set("Idempotency-Key", "reg-teen-1")
      .send({
        accountType: "teen",
        email: "newteen@bbyo.org",
        memberId: "TEEN-900",
        password: "ChangeMe123!",
        profile: {
          fullName: "New Teen",
          languages: ["en", "es"],
          interests: ["leadership"],
        },
      });

    expect(response.status).toBe(201);
    expect(response.body.data.user.role).toBe(Role.teen_pending);
    expect(response.body.data.user.status).toBe(UserStatus.pending);
  });

  it("promotes teen to verified after two unique active teen vouches", async () => {
    const app = createApp();

    const voucherA = { id: "voucher-a", role: Role.teen_verified, status: UserStatus.active };
    const voucherB = { id: "voucher-b", role: Role.teen_verified, status: UserStatus.active };
    const target = { id: "teen-target", role: Role.teen_pending, status: UserStatus.pending };
    const users: Record<string, any> = {
      [voucherA.id]: voucherA,
      [voucherB.id]: voucherB,
      [target.id]: target,
    };

    prismaMock.user.findFirst.mockImplementation(({ where }: any) => Promise.resolve(users[where.id] ?? null));
    prismaMock.user.findUnique.mockImplementation(({ where }: any) => Promise.resolve(users[where.id] ?? null));
    prismaMock.verificationVouch.findFirst.mockResolvedValue(null);
    prismaMock.verificationVouch.create.mockResolvedValue({ id: "vouch-1" });
    prismaMock.verificationVouch.findMany
      .mockResolvedValueOnce([{ vouchedByUserId: voucherA.id }])
      .mockResolvedValueOnce([{ vouchedByUserId: voucherA.id }, { vouchedByUserId: voucherB.id }]);
    prismaMock.user.update.mockResolvedValue({ ...target, role: Role.teen_verified, status: UserStatus.active });
    prismaMock.notification.create.mockResolvedValue({ id: "notif-1" });
    prismaMock.auditLog.create.mockResolvedValue({ id: "audit-2" });

    const first = await request(app)
      .post("/verification/vouches")
      .set("Authorization", `Bearer ${tokenFor(voucherA)}`)
      .set("Idempotency-Key", "vouch-1")
      .send({ targetUserId: target.id });

    const second = await request(app)
      .post("/verification/vouches")
      .set("Authorization", `Bearer ${tokenFor(voucherB)}`)
      .set("Idempotency-Key", "vouch-2")
      .send({ targetUserId: target.id });

    expect(first.status).toBe(201);
    expect(first.body.data.transitionedToVerified).toBe(false);

    expect(second.status).toBe(201);
    expect(second.body.data.transitionedToVerified).toBe(true);
    expect(prismaMock.user.update).toHaveBeenCalled();
  });
});
