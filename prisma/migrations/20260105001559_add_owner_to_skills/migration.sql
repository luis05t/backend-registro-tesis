-- AlterTable
ALTER TABLE "Skills" ADD COLUMN     "createdById" TEXT;

-- AddForeignKey
ALTER TABLE "Skills" ADD CONSTRAINT "Skills_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
