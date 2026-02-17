/*
  Warnings:

  - A unique constraint covering the columns `[trackerEventId]` on the table `Event` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "trackerEventId" TEXT,
ADD COLUMN     "trackerSyncAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Bus" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "trackerId" TEXT,
    "korwilId" TEXT,
    "eventId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusKorda" (
    "id" TEXT NOT NULL,
    "busId" TEXT NOT NULL,
    "kordaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusKorda_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Bus_trackerId_key" ON "Bus"("trackerId");

-- CreateIndex
CREATE INDEX "Bus_eventId_idx" ON "Bus"("eventId");

-- CreateIndex
CREATE INDEX "Bus_korwilId_idx" ON "Bus"("korwilId");

-- CreateIndex
CREATE INDEX "Bus_trackerId_idx" ON "Bus"("trackerId");

-- CreateIndex
CREATE INDEX "BusKorda_busId_idx" ON "BusKorda"("busId");

-- CreateIndex
CREATE INDEX "BusKorda_kordaId_idx" ON "BusKorda"("kordaId");

-- CreateIndex
CREATE UNIQUE INDEX "BusKorda_busId_kordaId_key" ON "BusKorda"("busId", "kordaId");

-- CreateIndex
CREATE UNIQUE INDEX "Event_trackerEventId_key" ON "Event"("trackerEventId");

-- AddForeignKey
ALTER TABLE "Bus" ADD CONSTRAINT "Bus_korwilId_fkey" FOREIGN KEY ("korwilId") REFERENCES "Korwil"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bus" ADD CONSTRAINT "Bus_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusKorda" ADD CONSTRAINT "BusKorda_busId_fkey" FOREIGN KEY ("busId") REFERENCES "Bus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusKorda" ADD CONSTRAINT "BusKorda_kordaId_fkey" FOREIGN KEY ("kordaId") REFERENCES "Korda"("id") ON DELETE CASCADE ON UPDATE CASCADE;
