-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "idApi" TEXT NOT NULL,
    "nis" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "ttl" TEXT NOT NULL,
    "photoUrl" TEXT,
    "parrentPhone" TEXT,
    "dormitory" TEXT NOT NULL,
    "fullAddress" TEXT NOT NULL,
    "village" TEXT NOT NULL,
    "provinceId" INTEGER,
    "regencyId" INTEGER,
    "districtId" INTEGER,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Province" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "Province_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Regency" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT,
    "type" TEXT,
    "code" TEXT NOT NULL,
    "fullCode" TEXT NOT NULL,
    "provinceId" INTEGER NOT NULL,

    CONSTRAINT "Regency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "District" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "fullCode" TEXT NOT NULL,
    "regencyId" INTEGER NOT NULL,

    CONSTRAINT "District_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Village" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "fullCode" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "districtId" INTEGER NOT NULL,

    CONSTRAINT "Village_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Student_idApi_key" ON "Student"("idApi");

-- CreateIndex
CREATE UNIQUE INDEX "Student_nis_key" ON "Student"("nis");

-- CreateIndex
CREATE INDEX "Student_status_idx" ON "Student"("status");

-- CreateIndex
CREATE INDEX "Student_name_idx" ON "Student"("name");

-- CreateIndex
CREATE INDEX "Student_regencyId_idx" ON "Student"("regencyId");

-- CreateIndex
CREATE INDEX "Student_dormitory_idx" ON "Student"("dormitory");

-- CreateIndex
CREATE INDEX "Province_name_idx" ON "Province"("name");

-- CreateIndex
CREATE INDEX "Regency_provinceId_idx" ON "Regency"("provinceId");

-- CreateIndex
CREATE INDEX "Regency_name_idx" ON "Regency"("name");

-- CreateIndex
CREATE INDEX "Regency_label_idx" ON "Regency"("label");

-- CreateIndex
CREATE INDEX "District_regencyId_idx" ON "District"("regencyId");

-- CreateIndex
CREATE INDEX "District_name_idx" ON "District"("name");

-- CreateIndex
CREATE INDEX "Village_districtId_idx" ON "Village"("districtId");

-- CreateIndex
CREATE INDEX "Village_name_idx" ON "Village"("name");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "Province"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_regencyId_fkey" FOREIGN KEY ("regencyId") REFERENCES "Regency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Regency" ADD CONSTRAINT "Regency_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "Province"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "District" ADD CONSTRAINT "District_regencyId_fkey" FOREIGN KEY ("regencyId") REFERENCES "Regency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Village" ADD CONSTRAINT "Village_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
