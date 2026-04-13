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

describe("Critical flows: feed, events, moderation, messaging", () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  it("enforces feed publish permissions for pending users", async () => {
    const app = createApp();

    const pendingTeen = { id: "teen-p", role: Role.teen_pending, status: UserStatus.pending };
    const verifiedTeen = { id: "teen-v", role: Role.teen_verified, status: UserStatus.active };

    prismaMock.user.findFirst.mockImplementation(({ where }: any) => {
      if (where?.id === pendingTeen.id) return Promise.resolve(pendingTeen);
      if (where?.id === verifiedTeen.id) return Promise.resolve(verifiedTeen);
      return Promise.resolve(null);
    });

    prismaMock.post.create.mockResolvedValue({ id: "post-1", authorUserId: verifiedTeen.id, text: "Ready to post" });

    const pendingRes = await request(app)
      .post("/feed")
      .set("Authorization", `Bearer ${tokenFor(pendingTeen)}`)
      .send({
        category: "general",
        text: "I should be blocked",
        language: "en",
        visibility: "global",
      });

    const verifiedRes = await request(app)
      .post("/feed")
      .set("Authorization", `Bearer ${tokenFor(verifiedTeen)}`)
      .send({
        category: "general",
        text: "Ready to post",
        language: "en",
        visibility: "global",
      });

    expect(pendingRes.status).toBe(403);
    expect(verifiedRes.status).toBe(201);
  });

  it("supports event registration and reminders", async () => {
    const app = createApp();
    const teen = { id: "teen-event", role: Role.teen_verified, status: UserStatus.active };

    prismaMock.user.findFirst.mockResolvedValue(teen);
    prismaMock.event.findFirst.mockResolvedValue({ id: "event-1", visibility: "public", deletedAt: null });
    prismaMock.eventRegistration.upsert.mockResolvedValue({ id: "reg-1", eventId: "event-1", userId: teen.id, status: "registered" });
    prismaMock.eventReminder.create.mockResolvedValue({ id: "rem-1", eventId: "event-1", userId: teen.id });

    const registerRes = await request(app)
      .post("/events/event-1/register")
      .set("Authorization", `Bearer ${tokenFor(teen)}`)
      .send();

    const reminderRes = await request(app)
      .post("/events/event-1/reminders")
      .set("Authorization", `Bearer ${tokenFor(teen)}`)
      .send({ remindAt: new Date(Date.now() + 60_000).toISOString() });

    expect(registerRes.status).toBe(201);
    expect(reminderRes.status).toBe(201);
  });

  it("resolves report and applies moderation action", async () => {
    const app = createApp();
    const reporter = { id: "teen-reporter", role: Role.teen_verified, status: UserStatus.active };
    const moderator = { id: "mod-1", role: Role.moderator, status: UserStatus.active };

    prismaMock.user.findFirst.mockImplementation(({ where }: any) => {
      if (where?.id === reporter.id) return Promise.resolve(reporter);
      if (where?.id === moderator.id) return Promise.resolve(moderator);
      return Promise.resolve(null);
    });

    prismaMock.report.create.mockResolvedValue({ id: "report-1", reporterId: reporter.id, targetType: "post", targetId: "post-1", status: "open" });
    prismaMock.auditLog.create.mockResolvedValue({ id: "audit-1" });
    prismaMock.report.findUnique.mockResolvedValue({ id: "report-1", targetType: "post", targetId: "post-1", status: "open", deletedAt: null });
    prismaMock.moderationAction.create.mockResolvedValue({ id: "action-1", reportId: "report-1", actionType: "hide_content" });
    prismaMock.post.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.report.update.mockResolvedValue({ id: "report-1", status: "resolved", actions: [{ id: "action-1" }] });

    const reportRes = await request(app)
      .post("/reports")
      .set("Authorization", `Bearer ${tokenFor(reporter)}`)
      .send({
        targetType: "post",
        targetId: "post-1",
        reason: "Unsafe content",
      });

    const resolveRes = await request(app)
      .patch("/reports/report-1/resolve")
      .set("Authorization", `Bearer ${tokenFor(moderator)}`)
      .send({
        status: "resolved",
        actionType: "hide_content",
        notes: "Hidden pending review",
      });

    expect(reportRes.status).toBe(201);
    expect(resolveRes.status).toBe(200);
    expect(prismaMock.post.updateMany).toHaveBeenCalled();
  });

  it("records message read receipts", async () => {
    const app = createApp();
    const teen = { id: "teen-msg", role: Role.teen_verified, status: UserStatus.active };

    prismaMock.user.findFirst.mockResolvedValue(teen);
    prismaMock.message.findUnique.mockResolvedValue({ id: "msg-1", conversationId: "conv-1", deletedAt: null });
    prismaMock.conversationMember.findFirst.mockResolvedValue({ id: "cm-1", conversationId: "conv-1", userId: teen.id });
    prismaMock.messageReadReceipt.upsert.mockResolvedValue({ id: "rr-1", messageId: "msg-1", userId: teen.id });

    const receiptRes = await request(app)
      .post("/messages/messages/msg-1/read")
      .set("Authorization", `Bearer ${tokenFor(teen)}`)
      .send();

    expect(receiptRes.status).toBe(201);
    expect(prismaMock.messageReadReceipt.upsert).toHaveBeenCalled();
  });
});
