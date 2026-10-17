CREATE TYPE "JourneyDirection" AS ENUM ('OUTBOUND', 'RETURN');
CREATE TYPE "JourneyStatus" AS ENUM ('REGISTERED', 'CANCELLED');

ALTER TABLE "Registration"
  ALTER COLUMN "studentId" DROP NOT NULL,
  ADD COLUMN "externalParticipantId" TEXT,
  ADD COLUMN "originKordaId" TEXT,
  ADD COLUMN "originKordaNameSnapshot" TEXT,
  ADD COLUMN "registrarUserId" TEXT;

ALTER TABLE "Registration"
  ADD CONSTRAINT "Registration_exactly_one_participant_check"
  CHECK (("studentId" IS NOT NULL)::integer + ("externalParticipantId" IS NOT NULL)::integer = 1);

CREATE UNIQUE INDEX "Registration_eventId_externalParticipantId_key"
  ON "Registration"("eventId", "externalParticipantId");
CREATE INDEX "Registration_externalParticipantId_idx"
  ON "Registration"("externalParticipantId");

ALTER TABLE "Registration"
  ADD CONSTRAINT "Registration_externalParticipantId_fkey"
  FOREIGN KEY ("externalParticipantId") REFERENCES "ExternalParticipant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "Journey" (
  "id" TEXT NOT NULL,
  "registrationId" TEXT NOT NULL,
  "direction" "JourneyDirection" NOT NULL,
  "destinationKordaId" TEXT NOT NULL,
  "destinationKordaNameSnapshot" TEXT NOT NULL,
  "dropPointId" TEXT,
  "locationNameSnapshot" TEXT NOT NULL,
  "travelDate" TIMESTAMP(3),
  "tariffSnapshot" INTEGER,
  "status" "JourneyStatus" NOT NULL DEFAULT 'REGISTERED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Journey_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Journey_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Journey_destinationKordaId_fkey" FOREIGN KEY ("destinationKordaId") REFERENCES "Korda"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Journey_dropPointId_fkey" FOREIGN KEY ("dropPointId") REFERENCES "DropPoint"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Journey_registrationId_direction_key" ON "Journey"("registrationId", "direction");
CREATE INDEX "Journey_destinationKordaId_direction_travelDate_idx" ON "Journey"("destinationKordaId", "direction", "travelDate");
CREATE INDEX "Journey_dropPointId_idx" ON "Journey"("dropPointId");

-- Preserve journey direction and location from existing registrations.
-- Legacy tariff is intentionally NULL: current DropPoint prices cannot prove what was charged historically.
INSERT INTO "Journey" (
  "id", "registrationId", "direction", "destinationKordaId", "destinationKordaNameSnapshot",
  "dropPointId", "locationNameSnapshot", "travelDate", "tariffSnapshot", "status", "createdAt", "updatedAt"
)
SELECT gen_random_uuid()::text, r."id", 'OUTBOUND'::"JourneyDirection", r."outboundKordaId", k."name",
       r."outboundDropPointId", COALESCE(dp."name", ''), r."outboundDate", NULL,
       CASE WHEN r."status" = 'CANCELLED' THEN 'CANCELLED'::"JourneyStatus" ELSE 'REGISTERED'::"JourneyStatus" END,
       r."createdAt", CURRENT_TIMESTAMP
FROM "Registration" r
JOIN "Korda" k ON k."id" = r."outboundKordaId"
LEFT JOIN "DropPoint" dp ON dp."id" = r."outboundDropPointId"
WHERE r."outboundKordaId" IS NOT NULL;

INSERT INTO "Journey" (
  "id", "registrationId", "direction", "destinationKordaId", "destinationKordaNameSnapshot",
  "dropPointId", "locationNameSnapshot", "travelDate", "tariffSnapshot", "status", "createdAt", "updatedAt"
)
SELECT gen_random_uuid()::text, r."id", 'RETURN'::"JourneyDirection", r."returnKordaId", k."name",
       r."returnDropPointId", COALESCE(dp."name", ''), r."returnDate", NULL,
       CASE WHEN r."status" = 'CANCELLED' OR r."status" = 'PARTIAL_CANCEL' AND r."outboundKordaId" IS NOT NULL
            THEN 'CANCELLED'::"JourneyStatus" ELSE 'REGISTERED'::"JourneyStatus" END,
       r."createdAt", CURRENT_TIMESTAMP
FROM "Registration" r
JOIN "Korda" k ON k."id" = r."returnKordaId"
LEFT JOIN "DropPoint" dp ON dp."id" = r."returnDropPointId"
WHERE r."returnKordaId" IS NOT NULL;

-- Snapshot known santri origin and destination registrar for existing data.
UPDATE "Registration" r
SET "originKordaId" = reg."kordaId",
    "originKordaNameSnapshot" = k."name"
FROM "Student" s
LEFT JOIN "Regency" reg ON reg."id" = s."regencyId"
LEFT JOIN "Korda" k ON k."id" = reg."kordaId"
WHERE r."studentId" = s."id";
