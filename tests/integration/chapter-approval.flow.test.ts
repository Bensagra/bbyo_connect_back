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

describe("Critical flow: chapter register + approval", () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  it("registers chapter as pending and then approves by advisor", async () => {
    const app = createApp();

    const chapterUser = {
      id: "chapter-user-1",
      email: "chapter@bbyo.org",
      memberId: "CHAP-777",
      role: Role.chapter_pending,
      status: UserStatus.pending,
      chapterProfile: { chapterId: "chapter-1", displayName: "Chapter One" },
    };

    const advisor = {
      id: "advisor-1",
      role: Role.advisor,
      status: UserStatus.active,
    };

    const users: Record<string, any> = {
      [chapterUser.id]: chapterUser,
      [advisor.id]: advisor,
    };

    prismaMock.user.findFirst.mockImplementation(({ where }: any) => {
      if (where?.OR) {
        return Promise.resolve(null);
      }
      return Promise.resolve(users[where.id] ?? null);
    });
    prismaMock.user.create.mockResolvedValue(chapterUser);
    prismaMock.chapter.findFirst.mockResolvedValue({ id: "chapter-1" });
    prismaMock.chapterApprovalRequest.create.mockResolvedValue({ id: "approval-1", chapterUserId: chapterUser.id, status: "pending" });
    prismaMock.sessionRefreshToken.create.mockResolvedValue({ id: "session-1" });
    prismaMock.auditLog.create.mockResolvedValue({ id: "audit-1" });

    const registerResponse = await request(app)
      .post("/auth/register")
      .set("Idempotency-Key", "chapter-reg-1")
      .send({
        accountType: "chapter",
        email: "chapter@bbyo.org",
        memberId: "CHAP-777",
        password: "ChangeMe123!",
        profile: {
          chapterId: "chapter-1",
          displayName: "Chapter One",
        },
      });

    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body.data.user.role).toBe(Role.chapter_pending);

    prismaMock.chapterApprovalRequest.findUnique.mockResolvedValue({
      id: "approval-1",
      chapterUserId: chapterUser.id,
      status: "pending",
      deletedAt: null,
    });
    prismaMock.chapterApprovalRequest.update.mockResolvedValue({
      id: "approval-1",
      chapterUserId: chapterUser.id,
      status: "approved",
      reviewerId: advisor.id,
    });
    prismaMock.user.update.mockResolvedValue({ id: chapterUser.id, role: Role.chapter_verified, status: UserStatus.active });
    prismaMock.notification.create.mockResolvedValue({ id: "notif-1" });

    const approveResponse = await request(app)
      .patch("/chapter-approvals/approval-1/approve")
      .set("Authorization", `Bearer ${tokenFor(advisor)}`)
      .send({ notes: "Approved by advisor" });

    expect(approveResponse.status).toBe(200);
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: Role.chapter_verified }),
      }),
    );
  });
});
