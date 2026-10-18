-- CreateEnum
CREATE TYPE "OutboundDispositionReason" AS ENUM ('WISUDA', 'PARTISIPAN', 'SEDANG_PULANG');

-- CreateEnum
CREATE TYPE "OutboundDispositionStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "OutboundDisposition" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "reason" "OutboundDispositionReason" NOT NULL,
    "status" "OutboundDispositionStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutboundDisposition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboundDispositionHistory" (
    "id" TEXT NOT NULL,
    "dispositionId" TEXT NOT NULL,
    "fromReason" "OutboundDispositionReason",
    "toReason" "OutboundDispositionReason" NOT NULL,
    "fromStatus" "OutboundDispositionStatus",
    "toStatus" "OutboundDispositionStatus" NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboundDispositionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OutboundDisposition_eventId_status_idx" ON "OutboundDisposition"("eventId", "status");

-- CreateIndex
CREATE INDEX "OutboundDisposition_studentId_status_idx" ON "OutboundDisposition"("studentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OutboundDisposition_eventId_studentId_key" ON "OutboundDisposition"("eventId", "studentId");

-- CreateIndex
CREATE INDEX "OutboundDispositionHistory_dispositionId_createdAt_idx" ON "OutboundDispositionHistory"("dispositionId", "createdAt");

-- CreateIndex
CREATE INDEX "OutboundDispositionHistory_actorUserId_createdAt_idx" ON "OutboundDispositionHistory"("actorUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "OutboundDisposition" ADD CONSTRAINT "OutboundDisposition_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundDisposition" ADD CONSTRAINT "OutboundDisposition_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundDispositionHistory" ADD CONSTRAINT "OutboundDispositionHistory_dispositionId_fkey" FOREIGN KEY ("dispositionId") REFERENCES "OutboundDisposition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
