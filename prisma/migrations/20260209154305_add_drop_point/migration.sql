-- CreateTable
CREATE TABLE "DropPoint" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL DEFAULT 0,
    "kordaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DropPoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DropPoint_kordaId_idx" ON "DropPoint"("kordaId");

-- AddForeignKey
ALTER TABLE "DropPoint" ADD CONSTRAINT "DropPoint_kordaId_fkey" FOREIGN KEY ("kordaId") REFERENCES "Korda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
