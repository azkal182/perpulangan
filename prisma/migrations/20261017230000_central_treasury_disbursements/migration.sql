CREATE TABLE "TreasuryDisbursement" (
  "id" TEXT NOT NULL,
  "kordaId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "disbursedAt" TIMESTAMP(3) NOT NULL,
  "note" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TreasuryDisbursement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TreasuryDisbursement_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "TreasuryDisbursement_kordaId_fkey" FOREIGN KEY ("kordaId") REFERENCES "Korda"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "TreasuryDisbursement_kordaId_disbursedAt_idx" ON "TreasuryDisbursement"("kordaId", "disbursedAt");

ALTER TABLE "FinancialAuditEntry" ADD COLUMN "disbursementId" TEXT;
ALTER TABLE "FinancialAuditEntry" ADD CONSTRAINT "FinancialAuditEntry_disbursementId_fkey" FOREIGN KEY ("disbursementId") REFERENCES "TreasuryDisbursement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
