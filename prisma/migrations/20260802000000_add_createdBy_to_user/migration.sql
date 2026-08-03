-- AlterTable
ALTER TABLE "User" ADD COLUMN "createdBy" TEXT;

-- CreateIndex
CREATE INDEX "User_createdBy_idx" ON "User"("createdBy");
