import argon2 from "argon2";
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

describe("Critical flow: chapter one-time login", () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  it("issues a one-time code from chapter and allows exactly one login", async () => {
    const app = createApp();

    const chapterActor = {
      id: "chapter-user-1",
      role: Role.chapter_verified,
      status: UserStatus.active,
    };

    const teenTarget = {
      id: "teen-target-1",
      email: "teen901@bbyo.org",
      memberId: "TEEN-901",
      role: Role.teen_verified,
      status: UserStatus.active,
      teenProfile: {
        chapterId: "chapter-1",
      },
    };

    prismaMock.user.findFirst.mockImplementation(({ where }: any) => {
      if (where?.id) {
        return Promise.resolve(where.id === chapterActor.id ? chapterActor : null);
      }
      if (where?.OR) {
        return Promise.resolve(teenTarget);
      }
      return Promise.resolve(null);
    });

    prismaMock.chapterProfile.findUnique.mockResolvedValue({ chapterId: "chapter-1" });
    prismaMock.chapter.findFirst.mockResolvedValue({ id: "chapter-1" });
    prismaMock.chapterOneTimeAccessCode.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.chapterOneTimeAccessCode.create.mockResolvedValue({
      id: "code-1",
      chapterId: "chapter-1",
      targetUserId: teenTarget.id,
      issuedByUserId: chapterActor.id,
      codeHash: "hash-placeholder",
      codeHint: "1X",
      attempts: 0,
      maxAttempts: 5,
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });
    prismaMock.auditLog.create.mockResolvedValue({ id: "audit-1" });

    const issueResponse = await request(app)
      .post("/auth/chapter-one-time-codes")
      .set("Authorization", `Bearer ${tokenFor(chapterActor)}`)
      .send({
        targetMemberIdOrEmail: teenTarget.memberId,
        expiresInMinutes: 15,
      });

    expect(issueResponse.status).toBe(201);
    expect(issueResponse.body.data.targetUser.id).toBe(teenTarget.id);
    expect(issueResponse.body.data.oneTimeCode).toMatch(/^[A-Z0-9]{8}$/);

    const issuedCode = issueResponse.body.data.oneTimeCode as string;
    const codeHash = await argon2.hash(issuedCode);

    prismaMock.chapterOneTimeAccessCode.findFirst
      .mockResolvedValueOnce({
        id: "code-1",
        chapterId: "chapter-1",
        targetUserId: teenTarget.id,
        issuedByUserId: chapterActor.id,
        codeHash,
        attempts: 0,
        maxAttempts: 5,
        usedAt: null,
        invalidatedAt: null,
        expiresAt: new Date("2030-01-01T00:00:00.000Z"),
        createdAt: new Date("2029-12-31T23:59:00.000Z"),
      })
      .mockResolvedValueOnce(null);

    prismaMock.chapterOneTimeAccessCode.update.mockResolvedValue({
      id: "code-1",
      usedAt: new Date("2029-12-31T23:59:30.000Z"),
    });
    prismaMock.user.update.mockResolvedValue({ id: teenTarget.id, lastLoginAt: new Date() });
    prismaMock.sessionRefreshToken.create.mockResolvedValue({ id: "session-1" });

    const loginResponse = await request(app)
      .post("/auth/login/chapter-code")
      .set("Idempotency-Key", "chapter-code-login-1")
      .send({
        memberIdOrEmail: teenTarget.memberId,
        oneTimeCode: issuedCode,
      });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.data.authMethod).toBe("chapter_one_time_code");
    expect(loginResponse.body.data.tokens.accessToken).toBeDefined();

    const secondLoginResponse = await request(app)
      .post("/auth/login/chapter-code")
      .set("Idempotency-Key", "chapter-code-login-2")
      .send({
        memberIdOrEmail: teenTarget.memberId,
        oneTimeCode: issuedCode,
      });

    expect(secondLoginResponse.status).toBe(401);
    expect(secondLoginResponse.body.error.code).toBe("INVALID_CHAPTER_ONE_TIME_CODE");
  });

  it("increments attempts and invalidates code at max attempts", async () => {
    const app = createApp();

    const teenTarget = {
      id: "teen-target-2",
      email: "teen902@bbyo.org",
      memberId: "TEEN-902",
      role: Role.teen_verified,
      status: UserStatus.active,
      teenProfile: {
        chapterId: "chapter-1",
      },
    };

    prismaMock.user.findFirst.mockResolvedValue(teenTarget);
    prismaMock.chapterOneTimeAccessCode.findFirst.mockResolvedValue({
      id: "code-2",
      chapterId: "chapter-1",
      targetUserId: teenTarget.id,
      issuedByUserId: "chapter-user-1",
      codeHash: await argon2.hash("REAL1234"),
      attempts: 4,
      maxAttempts: 5,
      usedAt: null,
      invalidatedAt: null,
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      createdAt: new Date("2029-12-31T23:59:00.000Z"),
    });

    prismaMock.chapterOneTimeAccessCode.update
      .mockResolvedValueOnce({ attempts: 5, maxAttempts: 5 })
      .mockResolvedValueOnce({ id: "code-2", invalidatedAt: new Date() });

    const response = await request(app)
      .post("/auth/login/chapter-code")
      .set("Idempotency-Key", "chapter-code-login-bad-1")
      .send({
        memberIdOrEmail: teenTarget.memberId,
        oneTimeCode: "WRONG123",
      });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_CHAPTER_ONE_TIME_CODE");
    expect(prismaMock.chapterOneTimeAccessCode.update).toHaveBeenCalledTimes(2);
  });
});
