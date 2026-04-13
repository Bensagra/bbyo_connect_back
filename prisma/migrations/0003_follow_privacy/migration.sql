-- CreateEnum
CREATE TYPE "public"."FollowStatus" AS ENUM ('pending', 'accepted');

-- AlterTable
ALTER TABLE "public"."User"
ADD COLUMN "isProfilePrivate" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "public"."UserFollow" (
    "id" TEXT NOT NULL,
    "followerUserId" TEXT NOT NULL,
    "followingUserId" TEXT NOT NULL,
    "status" "public"."FollowStatus" NOT NULL DEFAULT 'accepted',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "UserFollow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ChapterFollow" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ChapterFollow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserFollow_followerUserId_followingUserId_key" ON "public"."UserFollow"("followerUserId", "followingUserId");

-- CreateIndex
CREATE INDEX "UserFollow_followingUserId_status_idx" ON "public"."UserFollow"("followingUserId", "status");

-- CreateIndex
CREATE INDEX "UserFollow_followerUserId_status_idx" ON "public"."UserFollow"("followerUserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ChapterFollow_userId_chapterId_key" ON "public"."ChapterFollow"("userId", "chapterId");

-- CreateIndex
CREATE INDEX "ChapterFollow_chapterId_idx" ON "public"."ChapterFollow"("chapterId");

-- CreateIndex
CREATE INDEX "ChapterFollow_userId_idx" ON "public"."ChapterFollow"("userId");

-- AddForeignKey
ALTER TABLE "public"."UserFollow" ADD CONSTRAINT "UserFollow_followerUserId_fkey" FOREIGN KEY ("followerUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserFollow" ADD CONSTRAINT "UserFollow_followingUserId_fkey" FOREIGN KEY ("followingUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChapterFollow" ADD CONSTRAINT "ChapterFollow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChapterFollow" ADD CONSTRAINT "ChapterFollow_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "public"."Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
