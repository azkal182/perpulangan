/*
  Warnings:

  - Changed the type of `status` on the `Student` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "Student" DROP COLUMN "status",
ADD COLUMN     "status" BOOLEAN NOT NULL;

-- CreateIndex
CREATE INDEX "Student_status_idx" ON "Student"("status");
