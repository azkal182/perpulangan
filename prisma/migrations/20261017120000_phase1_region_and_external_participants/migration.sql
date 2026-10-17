CREATE TYPE "RegionalDataStatus" AS ENUM ('NEEDS_REVIEW', 'AUTO_MAPPED', 'VERIFIED');
CREATE TYPE "ExternalParticipantStatus" AS ENUM ('DRAFT', 'COMPLETE');

ALTER TABLE "Student"
  ADD COLUMN "sourceAddress" JSONB,
  ADD COLUMN "regionalStatus" "RegionalDataStatus" NOT NULL DEFAULT 'NEEDS_REVIEW',
  ADD COLUMN "regionalReviewNote" TEXT,
  ADD COLUMN "regionalReviewedAt" TIMESTAMP(3),
  ADD COLUMN "regionalReviewedByUserId" TEXT;

UPDATE "Student" s
SET "regionalStatus" = CASE
  WHEN s."provinceId" IS NOT NULL AND s."regencyId" IS NOT NULL AND r."kordaId" IS NOT NULL THEN 'AUTO_MAPPED'::"RegionalDataStatus"
  ELSE 'NEEDS_REVIEW'::"RegionalDataStatus"
END
FROM "Regency" r
WHERE s."regencyId" = r."id";

CREATE INDEX "Student_regionalStatus_idx" ON "Student"("regionalStatus");

CREATE TABLE "ExternalParticipant" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "gender" TEXT,
  "phone" TEXT,
  "guardianName" TEXT,
  "guardianRelationship" TEXT,
  "address" TEXT,
  "originKordaId" TEXT,
  "intendedKordaId" TEXT NOT NULL,
  "status" "ExternalParticipantStatus" NOT NULL DEFAULT 'DRAFT',
  "createdByUserId" TEXT NOT NULL,
  "updatedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExternalParticipant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExternalParticipant_originKordaId_fkey" FOREIGN KEY ("originKordaId") REFERENCES "Korda"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ExternalParticipant_intendedKordaId_fkey" FOREIGN KEY ("intendedKordaId") REFERENCES "Korda"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ExternalParticipant_intendedKordaId_status_idx" ON "ExternalParticipant"("intendedKordaId", "status");
CREATE INDEX "ExternalParticipant_originKordaId_idx" ON "ExternalParticipant"("originKordaId");
CREATE INDEX "ExternalParticipant_name_idx" ON "ExternalParticipant"("name");
