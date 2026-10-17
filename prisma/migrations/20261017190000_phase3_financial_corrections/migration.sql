CREATE TABLE "FinancialCorrection" (
  "id" TEXT NOT NULL,
  "paymentAllocationId" TEXT,
  "balanceSourceEntryId" TEXT,
  "amount" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "correctedAt" TIMESTAMP(3) NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "eventId" TEXT,
  "kordaScopeId" TEXT,
  CONSTRAINT "FinancialCorrection_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FinancialCorrection_paymentAllocationId_fkey" FOREIGN KEY ("paymentAllocationId") REFERENCES "PaymentAllocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FinancialCorrection_balanceSourceEntryId_fkey" FOREIGN KEY ("balanceSourceEntryId") REFERENCES "KordaBalanceEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FinancialCorrection_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "FinancialCorrection_single_source_check" CHECK (("paymentAllocationId" IS NOT NULL)::integer + ("balanceSourceEntryId" IS NOT NULL)::integer = 1)
);
CREATE INDEX "FinancialCorrection_paymentAllocationId_correctedAt_idx" ON "FinancialCorrection"("paymentAllocationId", "correctedAt");
CREATE INDEX "FinancialCorrection_balanceSourceEntryId_correctedAt_idx" ON "FinancialCorrection"("balanceSourceEntryId", "correctedAt");

ALTER TABLE "KordaBalanceEntry" ADD COLUMN "sourceCorrectionId" TEXT;
CREATE UNIQUE INDEX "KordaBalanceEntry_sourceCorrectionId_key" ON "KordaBalanceEntry"("sourceCorrectionId");
ALTER TABLE "KordaBalanceEntry" ADD CONSTRAINT "KordaBalanceEntry_sourceCorrectionId_fkey" FOREIGN KEY ("sourceCorrectionId") REFERENCES "FinancialCorrection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FinancialAuditEntry" ADD COLUMN "correctionId" TEXT;
ALTER TABLE "FinancialAuditEntry" ADD CONSTRAINT "FinancialAuditEntry_correctionId_fkey" FOREIGN KEY ("correctionId") REFERENCES "FinancialCorrection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EvidenceFile" ADD COLUMN "correctionId" TEXT;
CREATE UNIQUE INDEX "EvidenceFile_correctionId_key" ON "EvidenceFile"("correctionId");
ALTER TABLE "EvidenceFile" ADD CONSTRAINT "EvidenceFile_correctionId_fkey" FOREIGN KEY ("correctionId") REFERENCES "FinancialCorrection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
