import { PrismaClient, Role, UserStatus, Visibility, PostCategory, Locale, EventVisibility, EventRegistrationStatus, ResourceType, CreativeProjectStatus, PointsSourceType, ReportTargetType, ReportStatus, ModerationActionType, NotificationType, DevicePlatform } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import argon2 from "argon2";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env["DATABASE_URL"],
});

const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

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

type ImportedChapterSeed = {
  regionName: string;
  regionCountryCode: string;
  chapterName: string;
  chapterNumber?: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
};

const DEFAULT_IMPORTED_CHAPTER_PASSWORD = "Chapters2026!";

const importedChapters: ImportedChapterSeed[] = [
  {
    regionName: "Global - Argentina",
    regionCountryCode: "AR",
    chapterName: "Club Nautico Hacoaj BBYO",
    city: "Buenos Aires",
    country: "Argentina",
    lat: -34.6037,
    lng: -58.3816,
  },
  {
    regionName: "Global - Argentina",
    regionCountryCode: "AR",
    chapterName: "Cordoba BBYO",
    chapterNumber: "5681",
    city: "Cordoba",
    country: "Argentina",
    lat: -31.4201,
    lng: -64.1888,
  },
  {
    regionName: "Global - Argentina",
    regionCountryCode: "AR",
    chapterName: "Dimion BBYO",
    chapterNumber: "5613",
    city: "Buenos Aires",
    country: "Argentina",
    lat: -34.6037,
    lng: -58.3816,
  },
  {
    regionName: "Global - Argentina",
    regionCountryCode: "AR",
    chapterName: "Lejadesh BBYO",
    chapterNumber: "5612",
    city: "Buenos Aires",
    country: "Argentina",
    lat: -34.6037,
    lng: -58.3816,
  },
  {
    regionName: "Global - Argentina",
    regionCountryCode: "AR",
    chapterName: "Ligdol BBYO",
    chapterNumber: "5044",
    city: "Buenos Aires",
    country: "Argentina",
    lat: -34.6037,
    lng: -58.3816,
  },
  {
    regionName: "Global - Argentina",
    regionCountryCode: "AR",
    chapterName: "Meirim BBYO",
    chapterNumber: "5618",
    city: "Buenos Aires",
    country: "Argentina",
    lat: -34.6037,
    lng: -58.3816,
  },
  {
    regionName: "Global - Argentina",
    regionCountryCode: "AR",
    chapterName: "SHAbados BBYO",
    chapterNumber: "5045",
    city: "Buenos Aires",
    country: "Argentina",
    lat: -34.6037,
    lng: -58.3816,
  },
  {
    regionName: "Global - Asia Pacific Region",
    regionCountryCode: "AP",
    chapterName: "Beijing BBYO",
    city: "Beijing",
    country: "China",
    lat: 39.9042,
    lng: 116.4074,
  },
  {
    regionName: "Global - Asia Pacific Region",
    regionCountryCode: "AP",
    chapterName: "Hong Kong BBYO",
    city: "Hong Kong",
    country: "China",
    lat: 22.3193,
    lng: 114.1694,
  },
  {
    regionName: "Global - Asia Pacific Region",
    regionCountryCode: "AP",
    chapterName: "Singapore BBYO",
    city: "Singapore",
    country: "Singapore",
    lat: 1.3521,
    lng: 103.8198,
  },
  {
    regionName: "Global - Asia Pacific Region",
    regionCountryCode: "AP",
    chapterName: "Taipei BBYO",
    city: "Taipei",
    country: "Taiwan",
    lat: 25.033,
    lng: 121.5654,
  },
  {
    regionName: "Global - Asia Pacific Region",
    regionCountryCode: "AP",
    chapterName: "Tokyo BBYO",
    city: "Tokyo",
    country: "Japan",
    lat: 35.6762,
    lng: 139.6503,
  },
  {
    regionName: "Global - Asia Pacific Region",
    regionCountryCode: "AP",
    chapterName: "Zhenjews BBYO",
    city: "Shanghai",
    country: "China",
    lat: 31.2304,
    lng: 121.4737,
  },
  {
    regionName: "Global - Mexico",
    regionCountryCode: "MX",
    chapterName: "Los Chilangos BBYO",
    chapterNumber: "5543",
    city: "Ciudad de Mexico",
    country: "Mexico",
    lat: 19.4326,
    lng: -99.1332,
  },
  {
    regionName: "Global - Mexico",
    regionCountryCode: "MX",
    chapterName: "Mexico City BBYO",
    city: "Ciudad de Mexico",
    country: "Mexico",
    lat: 19.4326,
    lng: -99.1332,
  },
  {
    regionName: "Global - Chile",
    regionCountryCode: "CL",
    chapterName: "Jutzpa BBYO",
    chapterNumber: "5604",
    city: "Santiago",
    country: "Chile",
    lat: -33.4489,
    lng: -70.6693,
  },
  {
    regionName: "Global - Uruguay",
    regionCountryCode: "UY",
    chapterName: "Macabi Tzair BBYO",
    chapterNumber: "5409",
    city: "Montevideo",
    country: "Uruguay",
    lat: -34.9011,
    lng: -56.1645,
  },
  {
    regionName: "Global - Uruguay",
    regionCountryCode: "UY",
    chapterName: "Punta del Este BBYO",
    city: "Punta del Este",
    country: "Uruguay",
    lat: -34.968,
    lng: -54.9526,
  },
  {
    regionName: "Global - Uruguay",
    regionCountryCode: "UY",
    chapterName: "Zeut BBYO",
    chapterNumber: "5264",
    city: "Montevideo",
    country: "Uruguay",
    lat: -34.9011,
    lng: -56.1645,
  },
  {
    regionName: "Global - United Kingdom",
    regionCountryCode: "GB",
    chapterName: "Edgware - Deganya BBYO",
    chapterNumber: "5049",
    city: "Edgware",
    country: "United Kingdom",
    lat: 51.613,
    lng: -0.275,
  },
  {
    regionName: "Global - United Kingdom",
    regionCountryCode: "GB",
    chapterName: "Kehila BBYO",
    chapterNumber: "5602",
    city: "London",
    country: "United Kingdom",
    lat: 51.5072,
    lng: -0.1276,
  },
  {
    regionName: "Global - United Kingdom",
    regionCountryCode: "GB",
    chapterName: "Manchester BBYO",
    chapterNumber: "5051",
    city: "Manchester",
    country: "United Kingdom",
    lat: 53.4808,
    lng: -2.2426,
  },
  {
    regionName: "Global - United Kingdom",
    regionCountryCode: "GB",
    chapterName: "Mercaz BBYO",
    chapterNumber: "5050",
    city: "London",
    country: "United Kingdom",
    lat: 51.5072,
    lng: -0.1276,
  },
  {
    regionName: "Global - United Kingdom",
    regionCountryCode: "GB",
    chapterName: "Watford BBYO",
    city: "Watford",
    country: "United Kingdom",
    lat: 51.6565,
    lng: -0.3903,
  },
  {
    regionName: "Global - JDC's Active Jewish Teens: Ukraine",
    regionCountryCode: "UA",
    chapterName: "AJT Anahnu - Poltava",
    chapterNumber: "5448",
    city: "Poltava",
    country: "Ukraine",
    lat: 49.5883,
    lng: 34.5514,
  },
  {
    regionName: "Global - JDC's Active Jewish Teens: Ukraine",
    regionCountryCode: "UA",
    chapterName: "AJT Arayot - Kharkov",
    chapterNumber: "5449",
    city: "Kharkiv",
    country: "Ukraine",
    lat: 49.9935,
    lng: 36.2304,
  },
  {
    regionName: "Global - JDC's Active Jewish Teens: Ukraine",
    regionCountryCode: "UA",
    chapterName: "AJT Be Jewish (Krivoy Rog)",
    chapterNumber: "5451",
    city: "Kryvyi Rih",
    country: "Ukraine",
    lat: 47.9105,
    lng: 33.3918,
  },
  {
    regionName: "Global - JDC's Active Jewish Teens: Ukraine",
    regionCountryCode: "UA",
    chapterName: "AJT Boker - Chernigov",
    chapterNumber: "5453",
    city: "Chernihiv",
    country: "Ukraine",
    lat: 51.4982,
    lng: 31.2893,
  },
  {
    regionName: "Global - JDC's Active Jewish Teens: Ukraine",
    regionCountryCode: "UA",
    chapterName: "AJT Derekh - Odessa (JCC - Beit Grant)",
    chapterNumber: "5454",
    city: "Odesa",
    country: "Ukraine",
    lat: 46.4825,
    lng: 30.7233,
  },
  {
    regionName: "Global - JDC's Active Jewish Teens: Ukraine",
    regionCountryCode: "UA",
    chapterName: "AJT Jewish Teen Club - Vinnitza",
    chapterNumber: "5457",
    city: "Vinnytsia",
    country: "Ukraine",
    lat: 49.2331,
    lng: 28.4682,
  },
  {
    regionName: "Global - JDC's Active Jewish Teens: Ukraine",
    regionCountryCode: "UA",
    chapterName: "AJT Jeworld (Zaporozhye)",
    chapterNumber: "5458",
    city: "Zaporizhzhia",
    country: "Ukraine",
    lat: 47.8388,
    lng: 35.1396,
  },
  {
    regionName: "Global - JDC's Active Jewish Teens: Ukraine",
    regionCountryCode: "UA",
    chapterName: "AJT KIT Migdal - Odessa (JCC)",
    chapterNumber: "5461",
    city: "Odesa",
    country: "Ukraine",
    lat: 46.4825,
    lng: 30.7233,
  },
  {
    regionName: "Global - JDC's Active Jewish Teens: Ukraine",
    regionCountryCode: "UA",
    chapterName: "AJT Kohavim - Sumy",
    chapterNumber: "5463",
    city: "Sumy",
    country: "Ukraine",
    lat: 50.9077,
    lng: 34.7981,
  },
  {
    regionName: "Global - JDC's Active Jewish Teens: Ukraine",
    regionCountryCode: "UA",
    chapterName: "AJT Lo Domim - Kiev",
    chapterNumber: "5465",
    city: "Kyiv",
    country: "Ukraine",
    lat: 50.4501,
    lng: 30.5234,
  },
  {
    regionName: "Global - JDC's Active Jewish Teens: Ukraine",
    regionCountryCode: "UA",
    chapterName: "AJT Neurim (Lvov)",
    chapterNumber: "5466",
    city: "Lviv",
    country: "Ukraine",
    lat: 49.8397,
    lng: 24.0297,
  },
  {
    regionName: "Global - JDC's Active Jewish Teens: Ukraine",
    regionCountryCode: "UA",
    chapterName: "AJT Sababa - Krivoy Rog",
    chapterNumber: "5468",
    city: "Kryvyi Rih",
    country: "Ukraine",
    lat: 47.9105,
    lng: 33.3918,
  },
  {
    regionName: "Global - JDC's Active Jewish Teens: Ukraine",
    regionCountryCode: "UA",
    chapterName: "AJT Shahar - Dnepro",
    chapterNumber: "5469",
    city: "Dnipro",
    country: "Ukraine",
    lat: 48.4647,
    lng: 35.0462,
  },
  {
    regionName: "Global - JDC's Active Jewish Teens: Ukraine",
    regionCountryCode: "UA",
    chapterName: "AJT Simha - Mirgorod",
    chapterNumber: "5473",
    city: "Myrhorod",
    country: "Ukraine",
    lat: 49.9685,
    lng: 33.6089,
  },
  {
    regionName: "Global - JDC's Active Jewish Teens: Ukraine",
    regionCountryCode: "UA",
    chapterName: "AJT Teen Club - Nikolaev",
    chapterNumber: "5474",
    city: "Mykolaiv",
    country: "Ukraine",
    lat: 46.975,
    lng: 31.9946,
  },
  {
    regionName: "Global - JDC's Active Jewish Teens: Russia",
    regionCountryCode: "RU",
    chapterName: "AJT Lemon Club - Saratov",
    chapterNumber: "5426",
    city: "Saratov",
    country: "Russia",
    lat: 51.5331,
    lng: 46.0342,
  },
  {
    regionName: "Global - JDC's Active Jewish Teens: Russia",
    regionCountryCode: "RU",
    chapterName: "AJT 4eclub - Chelyzbinsk",
    chapterNumber: "5424",
    city: "Chelyabinsk",
    country: "Russia",
    lat: 55.1644,
    lng: 61.4368,
  },
  {
    regionName: "Global - JDC's Active Jewish Teens: Russia",
    regionCountryCode: "RU",
    chapterName: "AJT Adain Lo - Sankt Petersburg (JCC)",
    chapterNumber: "5425",
    city: "Saint Petersburg",
    country: "Russia",
    lat: 59.9311,
    lng: 30.3609,
  },
  {
    regionName: "Global - JDC's Active Jewish Teens: Russia",
    regionCountryCode: "RU",
    chapterName: "AJT Ani ve Ata - Izhevsk",
    chapterNumber: "5428",
    city: "Izhevsk",
    country: "Russia",
    lat: 56.8528,
    lng: 53.2115,
  },
  {
    regionName: "Global - JDC's Active Jewish Teens: Russia",
    regionCountryCode: "RU",
    chapterName: "AJT ChickFair - Orel",
    chapterNumber: "5429",
    city: "Orel",
    country: "Russia",
    lat: 52.9671,
    lng: 36.0696,
  },
  {
    regionName: "Global - JDC's Active Jewish Teens: Russia",
    regionCountryCode: "RU",
    chapterName: "Sameah Ufa",
    chapterNumber: "5427",
    city: "Ufa",
    country: "Russia",
    lat: 54.7388,
    lng: 55.9721,
  },
  {
    regionName: "Global - JDC's Active Jewish Teens: Russia",
    regionCountryCode: "RU",
    chapterName: "SIBJEW Krasnoyarsk",
    chapterNumber: "5566",
    city: "Krasnoyarsk",
    country: "Russia",
    lat: 56.0153,
    lng: 92.8932,
  },
  {
    regionName: "Canada Pacific Region",
    regionCountryCode: "CA",
    chapterName: "Balagan BBYO",
    city: "Vancouver",
    country: "Canada",
    lat: 49.2827,
    lng: -123.1207,
  },
  {
    regionName: "Hawaii",
    regionCountryCode: "US",
    chapterName: "Maui BBYO",
    city: "Maui",
    country: "United States",
    lat: 20.8893,
    lng: -156.4729,
  },
];

function stripBbyoFromName(value: string): string {
  return value
    .replace(/\bBBYO\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

async function seedImportedChapterDirectory(params: {
  advisorUserId: string;
  chapterPasswordHash: string;
}) {
  const regionIdByKey = new Map<string, string>();

  for (const [index, item] of importedChapters.entries()) {
    const regionKey = `${item.regionName}::${item.regionCountryCode}`;
    let regionId = regionIdByKey.get(regionKey);

    if (!regionId) {
      const region = await prisma.region.create({
        data: {
          name: item.regionName,
          countryCode: item.regionCountryCode,
        },
      });
      regionId = region.id;
      regionIdByKey.set(regionKey, regionId);
    }

    const normalizedChapterName = stripBbyoFromName(item.chapterName);
    const normalizedChapterNumber = item.chapterNumber?.replace(/[^0-9]/g, "");

    const chapter = await prisma.chapter.create({
      data: {
        name: normalizedChapterName,
        regionId,
        city: item.city,
        country: item.country,
        lat: item.lat,
        lng: item.lng,
        isActive: true,
      },
    });

    const memberId =
      normalizedChapterNumber && normalizedChapterNumber.length > 0
        ? `CHAP-${normalizedChapterNumber}`
        : `CHAP-AUTO-${70000 + index}`;

    const chapterUser = await prisma.user.create({
      data: {
        email: `${slugify(item.regionName)}.${slugify(normalizedChapterName)}.${index + 1}@chapters.bbyo.connect`,
        memberId,
        passwordHash: params.chapterPasswordHash,
        role: Role.chapter_verified,
        status: UserStatus.active,
      },
    });

    await prisma.chapterProfile.create({
      data: {
        userId: chapterUser.id,
        chapterId: chapter.id,
        displayName: normalizedChapterName,
        description:
          normalizedChapterNumber && normalizedChapterNumber.length > 0
            ? `Official chapter account. Chapter number #${normalizedChapterNumber}.`
            : "Official chapter account. Chapter number not provided.",
        location: `${item.city}, ${item.country}`,
        advisorUserId: params.advisorUserId,
      },
    });
  }

  return {
    regions: regionIdByKey.size,
    chapters: importedChapters.length,
  };
}

async function main() {
  await clearDatabase();

  const passwordHash = await argon2.hash("ChangeMe123!");
  const importedChapterPasswordHash = await argon2.hash(
    DEFAULT_IMPORTED_CHAPTER_PASSWORD,
  );

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

  const importedResult = await seedImportedChapterDirectory({
    advisorUserId: advisor.id,
    chapterPasswordHash: importedChapterPasswordHash,
  });

  console.log("Seed complete. Demo users password: ChangeMe123!");
  console.log(
    `Imported chapter directory complete. Regions: ${importedResult.regions}, chapters: ${importedResult.chapters}, default chapter password: ${DEFAULT_IMPORTED_CHAPTER_PASSWORD}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
