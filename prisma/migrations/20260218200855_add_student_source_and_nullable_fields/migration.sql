-- CreateEnum
CREATE TYPE "StudentSource" AS ENUM ('DAFU', 'MUSA');

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "fromApi" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "source" "StudentSource",
ALTER COLUMN "idApi" DROP NOT NULL,
ALTER COLUMN "nis" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Student_fromApi_idx" ON "Student"("fromApi");

-- CreateIndex
CREATE INDEX "Student_source_idx" ON "Student"("source");
