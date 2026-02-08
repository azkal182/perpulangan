-- CreateTable
CREATE TABLE "Korwil" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "picName" TEXT,
    "picPhone" TEXT,
    "picEmail" TEXT,
    "picUserId" TEXT,

    CONSTRAINT "Korwil_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Korda" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "picName" TEXT,
    "picPhone" TEXT,
    "picUserId" TEXT,
    "korwilId" TEXT,

    CONSTRAINT "Korda_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Korwil_picUserId_key" ON "Korwil"("picUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Korda_picUserId_key" ON "Korda"("picUserId");

-- AddForeignKey
ALTER TABLE "Korwil" ADD CONSTRAINT "Korwil_picUserId_fkey" FOREIGN KEY ("picUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Korda" ADD CONSTRAINT "Korda_picUserId_fkey" FOREIGN KEY ("picUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Korda" ADD CONSTRAINT "Korda_korwilId_fkey" FOREIGN KEY ("korwilId") REFERENCES "Korwil"("id") ON DELETE SET NULL ON UPDATE CASCADE;
