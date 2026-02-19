-- AlterTable
ALTER TABLE "Bus" ADD COLUMN     "capacity" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Registration" ADD COLUMN     "outboundBusId" TEXT,
ADD COLUMN     "returnBusId" TEXT;

-- CreateIndex
CREATE INDEX "Registration_outboundBusId_idx" ON "Registration"("outboundBusId");

-- CreateIndex
CREATE INDEX "Registration_returnBusId_idx" ON "Registration"("returnBusId");

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_outboundBusId_fkey" FOREIGN KEY ("outboundBusId") REFERENCES "Bus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_returnBusId_fkey" FOREIGN KEY ("returnBusId") REFERENCES "Bus"("id") ON DELETE SET NULL ON UPDATE CASCADE;
