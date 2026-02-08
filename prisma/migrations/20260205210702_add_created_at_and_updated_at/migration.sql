/*
  Warnings:

  - You are about to drop the column `picEmail` on the `Korwil` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `Korda` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Korwil` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Korda" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Korwil" DROP COLUMN "picEmail",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;
