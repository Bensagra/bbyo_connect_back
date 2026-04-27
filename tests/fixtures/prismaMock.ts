type Fn = jest.Mock<any, any>;

export const prismaMock = {
  user: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  teenProfile: {
    create: jest.fn(),
    createMany: jest.fn(),
  },
  chapterProfile: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
  },
  chapter: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
  region: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  verificationVouch: {
    findFirst: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  chapterApprovalRequest: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  sessionRefreshToken: {
    create: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  chapterOneTimeAccessCode: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  post: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  postReaction: {
    upsert: jest.fn(),
    updateMany: jest.fn(),
  },
  postComment: {
    findMany: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
  },
  story: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  conversation: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  conversationMember: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  message: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  messageReadReceipt: {
    upsert: jest.fn(),
    create: jest.fn(),
  },
  event: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  eventRegistration: {
    upsert: jest.fn(),
    updateMany: jest.fn(),
    create: jest.fn(),
  },
  eventReminder: {
    create: jest.fn(),
  },
  resource: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
  leaderboardSnapshot: {
    findFirst: jest.fn(),
  },
  pointsLedger: {
    aggregate: jest.fn(),
    findMany: jest.fn(),
    createMany: jest.fn(),
  },
  userBadge: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
  report: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  moderationAction: {
    create: jest.fn(),
  },
  notification: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
  },
  travelIntro: {
    create: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
    createMany: jest.fn(),
  },
};

export function resetPrismaMock() {
  const visit = (obj: unknown) => {
    if (!obj || typeof obj !== "object") {
      return;
    }

    for (const value of Object.values(obj)) {
      if (typeof value === "function" && (value as Fn).mockReset) {
        (value as Fn).mockReset();
      } else {
        visit(value);
      }
    }
  };

  visit(prismaMock);
}
