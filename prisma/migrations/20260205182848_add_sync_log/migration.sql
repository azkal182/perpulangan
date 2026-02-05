-- CreateTable
CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "lastSyncAt" TIMESTAMP(3),
    "lastStatus" TEXT,
    "lastSummary" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SyncLog_key_key" ON "SyncLog"("key");

-- CreateIndex
CREATE INDEX "SyncLog_key_idx" ON "SyncLog"("key");
