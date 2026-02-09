-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Registration" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "outboundKordaId" TEXT NOT NULL,
    "outboundDropPointId" TEXT NOT NULL,
    "outboundPaid" BOOLEAN NOT NULL DEFAULT false,
    "returnKordaId" TEXT NOT NULL,
    "returnDropPointId" TEXT NOT NULL,
    "returnPaid" BOOLEAN NOT NULL DEFAULT false,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'DRAFT',
    "kordaChanged" BOOLEAN NOT NULL DEFAULT false,
    "kordaChangeConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Registration_eventId_idx" ON "Registration"("eventId");

-- CreateIndex
CREATE INDEX "Registration_studentId_idx" ON "Registration"("studentId");

-- CreateIndex
CREATE INDEX "Registration_status_idx" ON "Registration"("status");

-- CreateIndex
CREATE INDEX "Registration_outboundKordaId_idx" ON "Registration"("outboundKordaId");

-- CreateIndex
CREATE INDEX "Registration_returnKordaId_idx" ON "Registration"("returnKordaId");

-- CreateIndex
CREATE UNIQUE INDEX "Registration_eventId_studentId_key" ON "Registration"("eventId", "studentId");

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_outboundKordaId_fkey" FOREIGN KEY ("outboundKordaId") REFERENCES "Korda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_outboundDropPointId_fkey" FOREIGN KEY ("outboundDropPointId") REFERENCES "DropPoint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_returnKordaId_fkey" FOREIGN KEY ("returnKordaId") REFERENCES "Korda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_returnDropPointId_fkey" FOREIGN KEY ("returnDropPointId") REFERENCES "DropPoint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
