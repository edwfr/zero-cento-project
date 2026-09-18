-- AlterTable
ALTER TABLE "exercises" ADD COLUMN     "updatedAt" TIMESTAMP(3),
ADD COLUMN     "updatedBy" TEXT;

-- CreateIndex
CREATE INDEX "exercises_updatedBy_idx" ON "exercises"("updatedBy");

-- AddForeignKey
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
