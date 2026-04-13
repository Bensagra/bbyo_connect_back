-- AlterTable
ALTER TABLE "public"."Event"
ADD COLUMN "regionId" TEXT,
ADD COLUMN "createdByUserId" TEXT,
ADD COLUMN "addressLine" TEXT,
ADD COLUMN "city" TEXT,
ADD COLUMN "country" TEXT,
ADD COLUMN "lat" DECIMAL(10,7),
ADD COLUMN "lng" DECIMAL(10,7);

-- CreateIndex
CREATE INDEX "Event_regionId_startAt_idx" ON "public"."Event"("regionId", "startAt");

-- AddForeignKey
ALTER TABLE "public"."Event" ADD CONSTRAINT "Event_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "public"."Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Event" ADD CONSTRAINT "Event_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
