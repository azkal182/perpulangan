CREATE TABLE "KordaWithdrawal" (
  "id" TEXT NOT NULL,
  "ownerKordaId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "withdrawnAt" TIMESTAMP(3) NOT NULL,
  "note" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KordaWithdrawal_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "KordaWithdrawal_ownerKordaId_fkey" FOREIGN KEY ("ownerKordaId") REFERENCES "Korda"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "KordaWithdrawal_amount_check" CHECK ("amount" > 0)
);
CREATE INDEX "KordaWithdrawal_ownerKordaId_withdrawnAt_idx" ON "KordaWithdrawal"("ownerKordaId", "withdrawnAt");

ALTER TABLE "FinancialAuditEntry" ADD COLUMN "withdrawalId" TEXT;
ALTER TABLE "FinancialAuditEntry" ADD CONSTRAINT "FinancialAuditEntry_withdrawalId_fkey" FOREIGN KEY ("withdrawalId") REFERENCES "KordaWithdrawal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
