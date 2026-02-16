/*
  Warnings:

  - Added the required column `registrarName` to the `Registration` table without a default value. This is not possible if the table is not empty.
  - Added the required column `registrarPhone` to the `Registration` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "RegistrationStatus" ADD VALUE IF NOT EXISTS 'PARTIAL_CANCEL';

-- DropForeignKey
ALTER TABLE "Registration" DROP CONSTRAINT IF EXISTS "Registration_outboundDropPointId_fkey";

-- DropForeignKey
ALTER TABLE "Registration" DROP CONSTRAINT IF EXISTS "Registration_outboundKordaId_fkey";

-- DropForeignKey
ALTER TABLE "Registration" DROP CONSTRAINT IF EXISTS "Registration_returnDropPointId_fkey";

-- DropForeignKey
ALTER TABLE "Registration" DROP CONSTRAINT IF EXISTS "Registration_returnKordaId_fkey";

-- Add new nullable columns first
ALTER TABLE "Registration" 
  ADD COLUMN IF NOT EXISTS "cancelReason" TEXT,
  ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "outboundDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "refundAmount" INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "returnDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "registrarName" TEXT,
  ADD COLUMN IF NOT EXISTS "registrarPhone" TEXT;

-- Update existing records with default values  
UPDATE "Registration" SET "registrarName" = 'Admin' WHERE "registrarName" IS NULL;
UPDATE "Registration" SET "registrarPhone" = '-' WHERE "registrarPhone" IS NULL;

-- Now make journey fields nullable and set defaults
ALTER TABLE "Registration" 
  ALTER COLUMN "outboundKordaId" DROP NOT NULL,
  ALTER COLUMN "outboundDropPointId" DROP NOT NULL,
  ALTER COLUMN "returnKordaId" DROP NOT NULL,
  ALTER COLUMN "returnDropPointId" DROP NOT NULL,
  ALTER COLUMN "status" SET DEFAULT 'CONFIRMED',
  ALTER COLUMN "registrarName" SET NOT NULL,
  ALTER COLUMN "registrarPhone" SET NOT NULL;

-- AddForeignKey with nullable support
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_outboundKordaId_fkey" 
  FOREIGN KEY ("outboundKordaId") REFERENCES "Korda"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Registration" ADD CONSTRAINT "Registration_outboundDropPointId_fkey" 
  FOREIGN KEY ("outboundDropPointId") REFERENCES "DropPoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Registration" ADD CONSTRAINT "Registration_returnKordaId_fkey" 
  FOREIGN KEY ("returnKordaId") REFERENCES "Korda"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Registration" ADD CONSTRAINT "Registration_returnDropPointId_fkey" 
  FOREIGN KEY ("returnDropPointId") REFERENCES "DropPoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;
