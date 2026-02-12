-- AlterTable
ALTER TABLE "User" ADD COLUMN     "activationToken" TEXT,
ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false;
