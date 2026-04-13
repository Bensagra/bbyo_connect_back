import { PrismaClient, Role, UserStatus, Visibility, PostCategory, Locale, EventVisibility, EventRegistrationStatus, ResourceType, CreativeProjectStatus, PointsSourceType, ReportTargetType, ReportStatus, ModerationActionType, NotificationType, DevicePlatform } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

async function clearDatabase() {
  await prisma.auditLog.deleteMany();
  await prisma.deviceToken.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.moderationAction.deleteMany();
  await prisma.report.deleteMany();
  await prisma.leaderboardSnapshot.deleteMany();
  await prisma.pointsLedger.deleteMany();
  await prisma.userBadge.deleteMany();
  await prisma.badge.deleteMany();
  await prisma.creativeProject.deleteMany();
  await prisma.resource.deleteMany();
  await prisma.eventReminder.deleteMany();
  await prisma.eventRegistration.deleteMany();
  await prisma.event.deleteMany();
  await prisma.messageReadReceipt.deleteMany();
  await prisma.messageAttachment.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversationMember.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.storyView.deleteMany();
  await prisma.story.deleteMany();
  await prisma.postReaction.deleteMany();
  await prisma.postComment.deleteMany();
  await prisma.postMedia.deleteMany();
  await prisma.post.deleteMany();
  await prisma.sessionRefreshToken.deleteMany();
  await prisma.chapterApprovalRequest.deleteMany();
  await prisma.verificationVouch.deleteMany();
  await prisma.travelIntro.deleteMany();
  await prisma.blockRelation.deleteMany();
  await prisma.safetyResource.deleteMany();
  await prisma.chapterProfile.deleteMany();
  await prisma.teenProfile.deleteMany();
  await prisma.chapter.deleteMany();
  await prisma.region.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  await clearDatabase();

  const passwordHash = await argon2.hash("ChangeMe123!");

  const [usaRegion, mexicoRegion, israelRegion, franceRegion] = await Promise.all([
    prisma.region.create({ data: { name: "Midwest", countryCode: "US" } }),
    prisma.region.create({ data: { name: "Centro", countryCode: "MX" } }),
    prisma.region.create({ data: { name: "Israel", countryCode: "IL" } }),
    prisma.region.create({ data: { name: "France", countryCode: "FR" } }),
  ]);

  const [chicagoChapter, cdmxChapter, telAvivChapter] = await Promise.all([
    prisma.chapter.create({
      data: {
        name: "Chicago North",
        regionId: usaRegion.id,
        city: "Chicago",
        country: "US",
        lat: 41.878113,
        lng: -87.629799,
        isActive: true,
      },
    }),
    prisma.chapter.create({
      data: {
        name: "CDMX Centro",
        regionId: mexicoRegion.id,
        city: "Ciudad de Mexico",
        country: "MX",
        lat: 19.432608,
        lng: -99.133209,
        isActive: true,
      },
    }),
    prisma.chapter.create({
      data: {
        name: "Tel Aviv Coast",
        regionId: israelRegion.id,
        city: "Tel Aviv",
        country: "IL",
        lat: 32.0853,
        lng: 34.781769,
        isActive: true,
      },
    }),
  ]);

  const advisor = await prisma.user.create({
    data: {
      email: "advisor@bbyo.org",
      memberId: "ADV-100",
      passwordHash,
      role: Role.advisor,
      status: UserStatus.active,
    },
  });

  const moderator = await prisma.user.create({
    data: {
      email: "mod@bbyo.org",
      memberId: "MOD-100",
      passwordHash,
      role: Role.moderator,
      status: UserStatus.active,
    },
  });

  const globalAdmin = await prisma.user.create({
    data: {
      email: "admin@bbyo.org",
      memberId: "GADM-100",
      passwordHash,
      role: Role.global_admin,
      status: UserStatus.active,
    },
  });

  const [teenVerifiedA, teenVerifiedB, teenPending, guestUser] = await Promise.all([
    prisma.user.create({
      data: {
        email: "teen.a@bbyo.org",
        memberId: "TEEN-100",
        passwordHash,
        role: Role.teen_verified,
        status: UserStatus.active,
      },
    }),
    prisma.user.create({
      data: {
        email: "teen.b@bbyo.org",
        memberId: "TEEN-101",
        passwordHash,
        role: Role.teen_verified,
        status: UserStatus.active,
      },
    }),
    prisma.user.create({
      data: {
        email: "teen.pending@bbyo.org",
        memberId: "TEEN-102",
        passwordHash,
        role: Role.teen_pending,
        status: UserStatus.pending,
      },
    }),
    prisma.user.create({
      data: {
        memberId: "GUEST-100",
        role: Role.guest,
        status: UserStatus.active,
      },
    }),
  ]);

  await prisma.teenProfile.createMany({
    data: [
      {
        userId: teenVerifiedA.id,
        fullName: "Leah Cohen",
        pronouns: "she/her",
        regionId: usaRegion.id,
        chapterId: chicagoChapter.id,
        avatarUrl: "https://cdn.bbyo.demo/avatars/leah.jpg",
        bio: "Leadership and service",
        languages: [Locale.en, Locale.he],
        interests: ["leadership", "music", "volunteering"],
      },
      {
        userId: teenVerifiedB.id,
        fullName: "Diego Ruiz",
        pronouns: "he/him",
        regionId: mexicoRegion.id,
        chapterId: cdmxChapter.id,
        avatarUrl: "https://cdn.bbyo.demo/avatars/diego.jpg",
        bio: "Creative projects and social impact",
        languages: [Locale.es, Locale.en],
        interests: ["design", "innovation"],
      },
      {
        userId: teenPending.id,
        fullName: "Maya Ben Ami",
        pronouns: "she/her",
        regionId: israelRegion.id,
        chapterId: telAvivChapter.id,
        avatarUrl: "https://cdn.bbyo.demo/avatars/maya.jpg",
        bio: "Excited to join BBYO Connect",
        languages: [Locale.he, Locale.en],
        interests: ["events", "community"],
      },
    ],
  });

  const chapterUser = await prisma.user.create({
    data: {
      email: "chapter.chi@bbyo.org",
      memberId: "CHAP-100",
      passwordHash,
      role: Role.chapter_verified,
      status: UserStatus.active,
    },
  });

  await prisma.chapterProfile.create({
    data: {
      userId: chapterUser.id,
      chapterId: chicagoChapter.id,
      displayName: "BBYO Chicago North",
      description: "Official chapter account managed by advisors",
      location: "Chicago, IL",
      advisorUserId: advisor.id,
    },
  });

  await prisma.verificationVouch.createMany({
    data: [
      {
        targetUserId: teenPending.id,
        vouchedByUserId: teenVerifiedA.id,
        status: "approved",
      },
      {
        targetUserId: teenPending.id,
        vouchedByUserId: teenVerifiedB.id,
        status: "approved",
      },
    ],
  });

  await prisma.user.update({
    where: { id: teenPending.id },
    data: { role: Role.teen_verified, status: UserStatus.active },
  });

  const chapterPendingUser = await prisma.user.create({
    data: {
      email: "chapter.pending@bbyo.org",
      memberId: "CHAP-101",
      passwordHash,
      role: Role.chapter_pending,
      status: UserStatus.pending,
    },
  });

  await prisma.chapterProfile.create({
    data: {
      userId: chapterPendingUser.id,
      chapterId: cdmxChapter.id,
      displayName: "BBYO CDMX Centro",
      description: "Cuenta en proceso de aprobación",
      location: "CDMX",
      advisorUserId: advisor.id,
    },
  });

  const approvalRequest = await prisma.chapterApprovalRequest.create({
    data: {
      chapterUserId: chapterPendingUser.id,
      status: "pending",
    },
  });

  await prisma.chapterApprovalRequest.update({
    where: { id: approvalRequest.id },
    data: {
      reviewerId: advisor.id,
      status: "approved",
      notes: "Verified by chapter advisor",
      decidedAt: new Date(),
    },
  });

  await prisma.user.update({
    where: { id: chapterPendingUser.id },
    data: { role: Role.chapter_verified, status: UserStatus.active },
  });

  const post = await prisma.post.create({
    data: {
      authorUserId: teenVerifiedA.id,
      category: PostCategory.leadership,
      text: "Leadership summit recap in four languages!",
      language: Locale.en,
      visibility: Visibility.global,
      media: {
        create: [{ type: "image", url: "https://cdn.bbyo.demo/posts/summit.jpg" }],
      },
    },
  });

  await prisma.postComment.create({
    data: {
      postId: post.id,
      userId: teenVerifiedB.id,
      text: "Gran trabajo, equipo!",
      language: Locale.es,
    },
  });

  await prisma.postReaction.createMany({
    data: [
      { postId: post.id, userId: teenVerifiedA.id, reactionType: "love" },
      { postId: post.id, userId: teenVerifiedB.id, reactionType: "clap" },
    ],
  });

  const conversation = await prisma.conversation.create({
    data: {
      type: "private",
      title: "Mentorship chat",
      isEncrypted: false,
      members: {
        create: [
          { userId: teenVerifiedA.id, role: "owner" },
          { userId: teenVerifiedB.id, role: "member" },
        ],
      },
    },
  });

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderId: teenVerifiedA.id,
      content: "Are you joining the global call tonight?",
      contentType: "text",
    },
  });

  await prisma.messageReadReceipt.create({
    data: {
      messageId: message.id,
      userId: teenVerifiedB.id,
      readAt: new Date(),
    },
  });

  const event = await prisma.event.create({
    data: {
      chapterId: chicagoChapter.id,
      title: "Global Leadership Workshop",
      description: "Cross-region hybrid workshop",
      startAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      endAt: new Date(Date.now() + 1000 * 60 * 60 * 26),
      timezone: "UTC",
      location: "Chicago HQ",
      isVirtual: true,
      visibility: EventVisibility.public,
    },
  });

  await prisma.eventRegistration.create({
    data: {
      eventId: event.id,
      userId: guestUser.id,
      status: EventRegistrationStatus.registered,
    },
  });

  await prisma.eventReminder.create({
    data: {
      eventId: event.id,
      userId: teenVerifiedA.id,
      remindAt: new Date(Date.now() + 1000 * 60 * 60 * 20),
    },
  });

  await prisma.resource.createMany({
    data: [
      {
        title: "Teen Safety Online",
        type: ResourceType.article,
        language: Locale.en,
        url: "https://resources.bbyo.org/safety-online",
        visibility: Visibility.global,
        createdBy: advisor.id,
      },
      {
        title: "Liderazgo juvenil práctico",
        type: ResourceType.pdf,
        language: Locale.es,
        url: "https://resources.bbyo.org/liderazgo.pdf",
        visibility: Visibility.region,
        createdBy: advisor.id,
      },
    ],
  });

  const impactBadge = await prisma.badge.create({
    data: {
      code: "IMPACT_100",
      name: "Impact Starter",
      description: "First 100 points earned",
      points: 100,
    },
  });

  await prisma.userBadge.create({
    data: {
      userId: teenVerifiedA.id,
      badgeId: impactBadge.id,
      awardedAt: new Date(),
    },
  });

  await prisma.pointsLedger.createMany({
    data: [
      {
        userId: teenVerifiedA.id,
        sourceType: PointsSourceType.post,
        sourceId: post.id,
        points: 40,
      },
      {
        userId: teenVerifiedA.id,
        sourceType: PointsSourceType.event_checkin,
        sourceId: event.id,
        points: 60,
      },
    ],
  });

  await prisma.leaderboardSnapshot.create({
    data: {
      scope: "global",
      period: "weekly",
      payloadJson: {
        generatedAt: new Date().toISOString(),
        topUsers: [{ userId: teenVerifiedA.id, points: 100 }],
      },
    },
  });

  const report = await prisma.report.create({
    data: {
      reporterId: teenVerifiedB.id,
      targetType: ReportTargetType.post,
      targetId: post.id,
      reason: "Possible harassment",
      details: "Needs moderator review",
      status: ReportStatus.open,
    },
  });

  await prisma.moderationAction.create({
    data: {
      reportId: report.id,
      moderatorId: moderator.id,
      actionType: ModerationActionType.note,
      notes: "Reviewed, no violation found",
    },
  });

  await prisma.report.update({
    where: { id: report.id },
    data: { status: ReportStatus.resolved },
  });

  await prisma.safetyResource.createMany({
    data: [
      {
        title: "Crisis Hotline US",
        locale: Locale.en,
        hotline: "988",
        url: "https://988lifeline.org",
        anonymousAllowed: true,
      },
      {
        title: "Linea de ayuda MX",
        locale: Locale.es,
        hotline: "800 911 2000",
        url: "https://www.gob.mx/salud",
        anonymousAllowed: true,
      },
      {
        title: "ERAN Israel",
        locale: Locale.he,
        hotline: "1201",
        url: "https://www.eran.org.il",
        anonymousAllowed: true,
      },
      {
        title: "SOS Amitie France",
        locale: Locale.fr,
        hotline: "09 72 39 40 50",
        url: "https://www.sos-amitie.com",
        anonymousAllowed: true,
      },
    ],
  });

  await prisma.notification.createMany({
    data: [
      {
        userId: teenVerifiedA.id,
        type: NotificationType.gamification,
        title: "Badge earned",
        body: "You unlocked Impact Starter",
      },
      {
        userId: chapterUser.id,
        type: NotificationType.event,
        title: "New event registration",
        body: "A guest registered for your public event",
      },
    ],
  });

  await prisma.deviceToken.create({
    data: {
      userId: teenVerifiedA.id,
      platform: DevicePlatform.ios,
      pushToken: "ios-demo-token-001",
    },
  });

  await prisma.auditLog.createMany({
    data: [
      {
        actorId: globalAdmin.id,
        action: "seed.bootstrap",
        entityType: "system",
        metadataJson: { scope: "full-demo" },
      },
      {
        actorId: advisor.id,
        action: "chapter.approved",
        entityType: "ChapterApprovalRequest",
        entityId: approvalRequest.id,
        metadataJson: { reviewerRole: Role.advisor },
      },
    ],
  });

  console.log("Seed complete. Demo users password: ChangeMe123!");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
