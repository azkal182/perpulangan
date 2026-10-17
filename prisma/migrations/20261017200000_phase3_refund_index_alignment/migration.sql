-- The finance-ledger migration creates this index, but the Prisma schema does
-- not declare it. Remove it after creation so replayed databases match schema.
DROP INDEX IF EXISTS "Refund_balanceSourceEntryId_refundedAt_idx";
