/*
  Warnings:

  - You are about to drop the `Kota` table. If the table is not empty, all the data it contains will be lost.

*/

-- AlterTable
ALTER TABLE "Regency" ADD COLUMN     "kordaId" TEXT;


-- CreateIndex
CREATE INDEX "Regency_kordaId_idx" ON "Regency"("kordaId");
