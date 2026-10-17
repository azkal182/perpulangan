CREATE TYPE "PaymentAllocationType" AS ENUM ('JOURNEY', 'BALANCE');
CREATE TYPE "BalanceEntryType" AS ENUM ('CREDIT', 'REFUND', 'CORRECTION');
CREATE TYPE "RefundMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'OTHER');
CREATE TYPE "LegacyPaymentStatus" AS ENUM ('OPEN', 'RECONCILED');

CREATE TABLE "Payment" (
  "id" TEXT NOT NULL, "eventId" TEXT NOT NULL, "payerName" TEXT NOT NULL,
  "amount" INTEGER NOT NULL, "method" TEXT NOT NULL, "paidAt" TIMESTAMP(3) NOT NULL,
  "noteSnapshot" TEXT NOT NULL, "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Payment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "Payment_eventId_paidAt_idx" ON "Payment"("eventId", "paidAt");

CREATE TABLE "PaymentAllocation" (
  "id" TEXT NOT NULL, "paymentId" TEXT NOT NULL, "type" "PaymentAllocationType" NOT NULL,
  "journeyId" TEXT, "balanceOwnerKordaId" TEXT, "participantNameSnapshot" TEXT NOT NULL,
  "originKordaNameSnapshot" TEXT, "destinationKordaNameSnapshot" TEXT NOT NULL,
  "payerNameSnapshot" TEXT NOT NULL, "amount" INTEGER NOT NULL,
  "createdByUserId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PaymentAllocation_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "Journey"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PaymentAllocation_balanceOwnerKordaId_fkey" FOREIGN KEY ("balanceOwnerKordaId") REFERENCES "Korda"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PaymentAllocation_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "PaymentAllocation_target_check" CHECK (("type" = 'JOURNEY' AND "journeyId" IS NOT NULL AND "balanceOwnerKordaId" IS NULL) OR ("type" = 'BALANCE' AND "journeyId" IS NULL AND "balanceOwnerKordaId" IS NOT NULL))
);
CREATE INDEX "PaymentAllocation_journeyId_idx" ON "PaymentAllocation"("journeyId");
CREATE INDEX "PaymentAllocation_balanceOwnerKordaId_createdAt_idx" ON "PaymentAllocation"("balanceOwnerKordaId", "createdAt");

CREATE TABLE "KordaBalanceEntry" (
  "id" TEXT NOT NULL, "ownerKordaId" TEXT NOT NULL, "originKordaNameSnapshot" TEXT,
  "destinationKordaNameSnapshot" TEXT NOT NULL, "participantNameSnapshot" TEXT NOT NULL,
  "payerNameSnapshot" TEXT, "sourcePaymentAllocationId" TEXT, "sourceRefundId" TEXT,
  "entryType" "BalanceEntryType" NOT NULL, "amount" INTEGER NOT NULL, "reason" TEXT,
  "createdByUserId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KordaBalanceEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "KordaBalanceEntry_ownerKordaId_fkey" FOREIGN KEY ("ownerKordaId") REFERENCES "Korda"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "KordaBalanceEntry_sourcePaymentAllocationId_fkey" FOREIGN KEY ("sourcePaymentAllocationId") REFERENCES "PaymentAllocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "KordaBalanceEntry_sourceRefundId_key" ON "KordaBalanceEntry"("sourceRefundId");
CREATE INDEX "KordaBalanceEntry_ownerKordaId_createdAt_idx" ON "KordaBalanceEntry"("ownerKordaId", "createdAt");

CREATE TABLE "Refund" (
  "id" TEXT NOT NULL, "paymentAllocationId" TEXT, "balanceSourceEntryId" TEXT, "amount" INTEGER NOT NULL,
  "reason" TEXT NOT NULL, "method" "RefundMethod" NOT NULL, "refundedAt" TIMESTAMP(3) NOT NULL,
  "createdByUserId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Refund_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Refund_paymentAllocationId_fkey" FOREIGN KEY ("paymentAllocationId") REFERENCES "PaymentAllocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Refund_amount_check" CHECK ("amount" > 0)
);
CREATE INDEX "Refund_paymentAllocationId_refundedAt_idx" ON "Refund"("paymentAllocationId", "refundedAt");
ALTER TABLE "KordaBalanceEntry" ADD CONSTRAINT "KordaBalanceEntry_sourceRefundId_fkey" FOREIGN KEY ("sourceRefundId") REFERENCES "Refund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_balanceSourceEntryId_fkey" FOREIGN KEY ("balanceSourceEntryId") REFERENCES "KordaBalanceEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Refund_balanceSourceEntryId_refundedAt_idx" ON "Refund"("balanceSourceEntryId", "refundedAt");

CREATE TABLE "EvidenceFile" (
  "id" TEXT NOT NULL, "storageKey" TEXT NOT NULL, "originalName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL, "sizeBytes" INTEGER NOT NULL, "sha256" TEXT NOT NULL,
  "uploadedByUserId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "purgedAt" TIMESTAMP(3), "paymentId" TEXT, "refundId" TEXT,
  CONSTRAINT "EvidenceFile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EvidenceFile_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EvidenceFile_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "EvidenceFile_storageKey_key" ON "EvidenceFile"("storageKey");
CREATE UNIQUE INDEX "EvidenceFile_paymentId_key" ON "EvidenceFile"("paymentId");
CREATE UNIQUE INDEX "EvidenceFile_refundId_key" ON "EvidenceFile"("refundId");

CREATE TABLE "FinancialAuditEntry" (
  "id" TEXT NOT NULL, "action" TEXT NOT NULL, "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL, "eventId" TEXT, "kordaScopeId" TEXT,
  "actorUserId" TEXT NOT NULL, "actorRoleSnapshot" TEXT NOT NULL, "amount" INTEGER,
  "reason" TEXT, "paymentId" TEXT, "refundId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FinancialAuditEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FinancialAuditEntry_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FinancialAuditEntry_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "FinancialAuditEntry_eventId_createdAt_idx" ON "FinancialAuditEntry"("eventId", "createdAt");
CREATE INDEX "FinancialAuditEntry_kordaScopeId_createdAt_idx" ON "FinancialAuditEntry"("kordaScopeId", "createdAt");
CREATE INDEX "FinancialAuditEntry_entityType_entityId_idx" ON "FinancialAuditEntry"("entityType", "entityId");

CREATE TABLE "LegacyPaymentReconciliation" (
  "id" TEXT NOT NULL, "registrationId" TEXT NOT NULL, "direction" "JourneyDirection" NOT NULL,
  "legacyMarkedPaid" BOOLEAN NOT NULL, "status" "LegacyPaymentStatus" NOT NULL DEFAULT 'OPEN',
  "reconciledByUserId" TEXT, "reconciledAt" TIMESTAMP(3), "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LegacyPaymentReconciliation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LegacyPaymentReconciliation_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "LegacyPaymentReconciliation_registrationId_direction_key" ON "LegacyPaymentReconciliation"("registrationId", "direction");
CREATE INDEX "LegacyPaymentReconciliation_status_createdAt_idx" ON "LegacyPaymentReconciliation"("status", "createdAt");

INSERT INTO "LegacyPaymentReconciliation" ("id", "registrationId", "direction", "legacyMarkedPaid")
SELECT gen_random_uuid()::text, r."id", 'OUTBOUND'::"JourneyDirection", TRUE FROM "Registration" r WHERE r."outboundPaid" = TRUE
ON CONFLICT ("registrationId", "direction") DO NOTHING;
INSERT INTO "LegacyPaymentReconciliation" ("id", "registrationId", "direction", "legacyMarkedPaid")
SELECT gen_random_uuid()::text, r."id", 'RETURN'::"JourneyDirection", TRUE FROM "Registration" r WHERE r."returnPaid" = TRUE
ON CONFLICT ("registrationId", "direction") DO NOTHING;
