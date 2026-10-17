CREATE TABLE "JourneyBusAssignment" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "busId" TEXT,
    "previousBusLabelSnapshot" TEXT,
    "changedAt" TIMESTAMP(3),
    "changedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "JourneyBusAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "JourneyBusAssignment_journeyId_key" ON "JourneyBusAssignment"("journeyId");
CREATE INDEX "JourneyBusAssignment_busId_idx" ON "JourneyBusAssignment"("busId");

ALTER TABLE "JourneyBusAssignment"
  ADD CONSTRAINT "JourneyBusAssignment_journeyId_fkey"
  FOREIGN KEY ("journeyId") REFERENCES "Journey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JourneyBusAssignment"
  ADD CONSTRAINT "JourneyBusAssignment_busId_fkey"
  FOREIGN KEY ("busId") REFERENCES "Bus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Preserve existing placements as the initial journey-level source of truth.
INSERT INTO "JourneyBusAssignment" ("id", "journeyId", "busId", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, j."id", r."outboundBusId", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Journey" j
JOIN "Registration" r ON r."id" = j."registrationId"
WHERE j."direction" = 'OUTBOUND' AND r."outboundBusId" IS NOT NULL
ON CONFLICT ("journeyId") DO NOTHING;

INSERT INTO "JourneyBusAssignment" ("id", "journeyId", "busId", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, j."id", r."returnBusId", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Journey" j
JOIN "Registration" r ON r."id" = j."registrationId"
WHERE j."direction" = 'RETURN' AND r."returnBusId" IS NOT NULL
ON CONFLICT ("journeyId") DO NOTHING;
