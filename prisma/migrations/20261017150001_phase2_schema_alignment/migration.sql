-- DropForeignKey
ALTER TABLE "Registration" DROP CONSTRAINT "Registration_studentId_fkey";

-- DropIndex
DROP INDEX "Registration_externalParticipantId_idx";

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;
