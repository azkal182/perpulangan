ALTER TABLE "FinancialAuditEntry" DROP CONSTRAINT "FinancialAuditEntry_withdrawalId_fkey";
ALTER TABLE "FinancialAuditEntry" DROP COLUMN "withdrawalId";
DROP TABLE "KordaWithdrawal";
