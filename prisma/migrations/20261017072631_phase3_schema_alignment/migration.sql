-- DropIndex
-- This index is created by the later finance-ledger migration; keep clean
-- shadow-database replays valid when it does not exist yet. A later alignment
-- migration removes it after creation to match the Prisma schema.
DROP INDEX IF EXISTS "Refund_balanceSourceEntryId_refundedAt_idx";
