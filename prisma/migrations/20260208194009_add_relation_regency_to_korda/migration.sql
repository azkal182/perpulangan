-- AddForeignKey
ALTER TABLE "Regency" ADD CONSTRAINT "Regency_kordaId_fkey" FOREIGN KEY ("kordaId") REFERENCES "Korda"("id") ON DELETE SET NULL ON UPDATE CASCADE;
