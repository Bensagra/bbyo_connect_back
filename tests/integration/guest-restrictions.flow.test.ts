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

describe("Critical flow: guest restrictions", () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  it("allows guest signup but blocks chat/feed/private event actions", async () => {
    const app = createApp();

    const guest = {
      id: "guest-1",
      memberId: "GUEST-1",
      role: Role.guest,
      status: UserStatus.active,
    };

    prismaMock.user.create.mockResolvedValue(guest);
    prismaMock.sessionRefreshToken.create.mockResolvedValue({ id: "session-guest-1" });
    prismaMock.auditLog.create.mockResolvedValue({ id: "audit-guest-1" });

    const guestSignup = await request(app)
      .post("/auth/guest")
      .set("Idempotency-Key", "guest-1")
      .send({ locale: "en" });

    expect(guestSignup.status).toBe(201);
    expect(guestSignup.body.data.user.role).toBe(Role.guest);

    prismaMock.user.findFirst.mockImplementation(({ where }: any) => Promise.resolve(where?.id === guest.id ? guest : null));
    prismaMock.event.findFirst.mockResolvedValue({ id: "event-1", visibility: "chapter", deletedAt: null });

    const token = tokenFor(guest);

    const chatResponse = await request(app)
      .post("/messages/conversations")
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "private", memberIds: ["teen-1"], title: "Test" });

    const feedResponse = await request(app)
      .post("/feed")
      .set("Authorization", `Bearer ${token}`)
      .send({
        category: "general",
        text: "hello",
        language: "en",
        visibility: "public",
      });

    const privateEventRegistration = await request(app)
      .post("/events/event-1/register")
      .set("Authorization", `Bearer ${token}`)
      .send();

    expect(chatResponse.status).toBe(403);
    expect(feedResponse.status).toBe(403);
    expect(privateEventRegistration.status).toBe(403);
  });
});
