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

describe("Critical flow: admin panel controls users and chapters", () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  it("lists users for staff roles", async () => {
    const app = createApp();

    const moderator = {
      id: "mod-1",
      role: Role.moderator,
      status: UserStatus.active,
    };

    prismaMock.user.findFirst.mockImplementation(({ where }: any) => {
      if (where?.id === moderator.id) {
        return Promise.resolve(moderator);
      }
      return Promise.resolve(null);
    });

    prismaMock.user.findMany.mockResolvedValue([
      {
        id: "teen-1",
        memberId: "TEEN-1",
        email: "teen1@bbyo.org",
        passwordHash: "hidden",
        role: Role.teen_pending,
        status: UserStatus.pending,
        deletedAt: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        teenProfile: {
          fullName: "Teen One",
          chapterId: "chapter-1",
          regionId: "region-1",
          avatarUrl: null,
        },
        chapterProfile: null,
      },
    ]);

    const response = await request(app)
      .get("/admin/users")
      .set("Authorization", `Bearer ${tokenFor(moderator)}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].passwordHash).toBeUndefined();
    expect(response.body.data[0].memberId).toBe("TEEN-1");
  });

  it("admits a pending chapter user from admin panel", async () => {
    const app = createApp();

    const admin = {
      id: "global-admin-1",
      role: Role.global_admin,
      status: UserStatus.active,
    };

    const chapterPending = {
      id: "chapter-user-1",
      memberId: "CHAP-01",
      role: Role.chapter_pending,
      status: UserStatus.pending,
      deletedAt: null,
    };

    prismaMock.user.findFirst.mockImplementation(({ where }: any) => {
      if (where?.id === admin.id) {
        return Promise.resolve(admin);
      }
      if (where?.id === chapterPending.id) {
        return Promise.resolve(chapterPending);
      }
      return Promise.resolve(null);
    });

    prismaMock.user.update.mockResolvedValue({
      ...chapterPending,
      role: Role.chapter_verified,
      status: UserStatus.active,
    });

    prismaMock.chapterApprovalRequest.findFirst.mockResolvedValue({
      id: "approval-1",
      chapterUserId: chapterPending.id,
      status: "pending",
      deletedAt: null,
    });

    prismaMock.chapterApprovalRequest.update.mockResolvedValue({
      id: "approval-1",
      chapterUserId: chapterPending.id,
      status: "approved",
      reviewerId: admin.id,
    });

    prismaMock.notification.create.mockResolvedValue({ id: "notif-1" });
    prismaMock.auditLog.create.mockResolvedValue({ id: "audit-1" });

    const response = await request(app)
      .patch(`/admin/users/${chapterPending.id}/admit`)
      .set("Authorization", `Bearer ${tokenFor(admin)}`)
      .send({ notes: "Approved from admin panel" });

    expect(response.status).toBe(200);
    expect(response.body.data.admitted).toBe(true);
    expect(response.body.data.user.role).toBe(Role.chapter_verified);
    expect(response.body.data.user.status).toBe(UserStatus.active);
  });

  it("admits a chapter by activating it", async () => {
    const app = createApp();

    const moderator = {
      id: "mod-2",
      role: Role.moderator,
      status: UserStatus.active,
    };

    const chapter = {
      id: "chapter-1",
      name: "Chapter One",
      regionId: "region-1",
      city: "Buenos Aires",
      country: "AR",
      lat: -34.6037,
      lng: -58.3816,
      isActive: false,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      deletedAt: null,
    };

    prismaMock.user.findFirst.mockImplementation(({ where }: any) => {
      if (where?.id === moderator.id) {
        return Promise.resolve(moderator);
      }
      return Promise.resolve(null);
    });

    prismaMock.chapter.findFirst.mockResolvedValue(chapter);
    prismaMock.chapter.update.mockResolvedValue({
      ...chapter,
      isActive: true,
    });
    prismaMock.auditLog.create.mockResolvedValue({ id: "audit-2" });

    const response = await request(app)
      .patch(`/admin/chapters/${chapter.id}/admit`)
      .set("Authorization", `Bearer ${tokenFor(moderator)}`)
      .send({ notes: "Admitted chapter" });

    expect(response.status).toBe(200);
    expect(response.body.data.admitted).toBe(true);
    expect(response.body.data.chapter.isActive).toBe(true);
  });
});
