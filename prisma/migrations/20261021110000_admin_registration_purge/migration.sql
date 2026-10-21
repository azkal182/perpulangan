ALTER TABLE "PaymentAllocation" ADD COLUMN "registrationId" TEXT;

UPDATE "PaymentAllocation" AS pa
SET "registrationId" = j."registrationId"
FROM "Journey" AS j
WHERE pa."journeyId" = j."id"
  AND pa."registrationId" IS NULL;

WITH candidates AS (
  SELECT pa."id" AS allocation_id, MIN(r."id") AS registration_id
  FROM "PaymentAllocation" AS pa
  JOIN "Payment" AS p ON p."id" = pa."paymentId"
  JOIN "Registration" AS r ON r."eventId" = p."eventId"
  JOIN "Journey" AS j ON j."registrationId" = r."id"
    AND j."destinationKordaNameSnapshot" = pa."destinationKordaNameSnapshot"
  LEFT JOIN "Student" AS s ON s."id" = r."studentId"
  LEFT JOIN "ExternalParticipant" AS ep ON ep."id" = r."externalParticipantId"
  WHERE pa."type" = 'BALANCE'
    AND pa."registrationId" IS NULL
    AND COALESCE(s."name", ep."name") = pa."participantNameSnapshot"
  GROUP BY pa."id"
  HAVING COUNT(DISTINCT r."id") = 1
)
UPDATE "PaymentAllocation" AS pa
SET "registrationId" = candidates.registration_id
FROM candidates
WHERE pa."id" = candidates.allocation_id;

CREATE INDEX "PaymentAllocation_registrationId_idx" ON "PaymentAllocation"("registrationId");

ALTER TABLE "PaymentAllocation"
ADD CONSTRAINT "PaymentAllocation_registrationId_fkey"
FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TYPE "PurgeEvidenceCleanupStatus" AS ENUM ('PENDING', 'DELETED', 'FAILED');

CREATE TABLE "RegistrationPurge" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "eventNameSnapshot" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "actorNameSnapshot" TEXT NOT NULL,
  "actorUsernameSnapshot" TEXT,
  "reason" TEXT NOT NULL,
  "participantCount" INTEGER NOT NULL,
  "registrationCount" INTEGER NOT NULL,
  "journeyCount" INTEGER NOT NULL,
  "paymentCount" INTEGER NOT NULL,
  "paymentAmount" INTEGER NOT NULL,
  "details" JSONB NOT NULL,
  "financialSnapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegistrationPurge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RegistrationPurge_eventId_createdAt_idx" ON "RegistrationPurge"("eventId", "createdAt");
CREATE INDEX "RegistrationPurge_actorUserId_createdAt_idx" ON "RegistrationPurge"("actorUserId", "createdAt");

CREATE TABLE "RegistrationPurgeEvidence" (
  "id" TEXT NOT NULL,
  "purgeId" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "status" "PurgeEvidenceCleanupStatus" NOT NULL DEFAULT 'PENDING',
  "errorMessage" TEXT,
  "attemptedAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegistrationPurgeEvidence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RegistrationPurgeEvidence_storageKey_key" ON "RegistrationPurgeEvidence"("storageKey");
CREATE INDEX "RegistrationPurgeEvidence_purgeId_status_idx" ON "RegistrationPurgeEvidence"("purgeId", "status");
CREATE INDEX "RegistrationPurgeEvidence_status_createdAt_idx" ON "RegistrationPurgeEvidence"("status", "createdAt");

ALTER TABLE "RegistrationPurgeEvidence"
ADD CONSTRAINT "RegistrationPurgeEvidence_purgeId_fkey"
FOREIGN KEY ("purgeId") REFERENCES "RegistrationPurge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
