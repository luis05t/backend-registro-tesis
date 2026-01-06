/*
  Warnings:

  - You are about to drop the column `createdBy` on the `Skills` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Skills" DROP CONSTRAINT "Skills_createdBy_fkey";

-- AlterTable
ALTER TABLE "Skills" DROP COLUMN "createdBy";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "image" TEXT;
