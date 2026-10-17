CREATE TYPE "JourneyBusAssignmentAction" AS ENUM ('ASSIGNED', 'REASSIGNED', 'UNASSIGNED');

CREATE TABLE "JourneyBusAssignmentHistory" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "action" "JourneyBusAssignmentAction" NOT NULL,
    "fromBusLabelSnapshot" TEXT,
    "toBusLabelSnapshot" TEXT,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JourneyBusAssignmentHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "JourneyBusAssignmentHistory_assignmentId_createdAt_idx"
  ON "JourneyBusAssignmentHistory"("assignmentId", "createdAt");

ALTER TABLE "JourneyBusAssignmentHistory"
  ADD CONSTRAINT "JourneyBusAssignmentHistory_assignmentId_fkey"
  FOREIGN KEY ("assignmentId") REFERENCES "JourneyBusAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing bus placements predate this history table; seed a neutral baseline.
INSERT INTO "JourneyBusAssignmentHistory" ("id", "assignmentId", "action", "toBusLabelSnapshot", "createdAt")
SELECT gen_random_uuid()::text, a."id", 'ASSIGNED', b."label", a."createdAt"
FROM "JourneyBusAssignment" a
JOIN "Bus" b ON b."id" = a."busId"
WHERE a."busId" IS NOT NULL;
