-- CreateTable
CREATE TABLE "public"."ChapterOneTimeAccessCode" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "issuedByUserId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "codeHint" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "invalidatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChapterOneTimeAccessCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChapterOneTimeAccessCode_chapterId_createdAt_idx" ON "public"."ChapterOneTimeAccessCode"("chapterId", "createdAt");

-- CreateIndex
CREATE INDEX "ChapterOneTimeAccessCode_targetUserId_expiresAt_idx" ON "public"."ChapterOneTimeAccessCode"("targetUserId", "expiresAt");

-- CreateIndex
CREATE INDEX "ChapterOneTimeAccessCode_issuedByUserId_createdAt_idx" ON "public"."ChapterOneTimeAccessCode"("issuedByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "ChapterOneTimeAccessCode_usedAt_invalidatedAt_idx" ON "public"."ChapterOneTimeAccessCode"("usedAt", "invalidatedAt");

-- AddForeignKey
ALTER TABLE "public"."ChapterOneTimeAccessCode" ADD CONSTRAINT "ChapterOneTimeAccessCode_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "public"."Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChapterOneTimeAccessCode" ADD CONSTRAINT "ChapterOneTimeAccessCode_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChapterOneTimeAccessCode" ADD CONSTRAINT "ChapterOneTimeAccessCode_issuedByUserId_fkey" FOREIGN KEY ("issuedByUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
