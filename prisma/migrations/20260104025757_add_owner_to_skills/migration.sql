-- AlterTable
ALTER TABLE "Skills" ADD COLUMN     "createdBy" TEXT;

-- AddForeignKey
ALTER TABLE "Skills" ADD CONSTRAINT "Skills_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
