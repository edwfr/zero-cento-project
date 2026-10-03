-- CreateTable
CREATE TABLE "subscription_renewals" (
    "id" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "durationMonths" INTEGER NOT NULL,
    "endDate" DATE NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_renewals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subscription_renewals_traineeId_endDate_idx" ON "subscription_renewals"("traineeId", "endDate");

-- AddForeignKey
ALTER TABLE "subscription_renewals" ADD CONSTRAINT "subscription_renewals_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_renewals" ADD CONSTRAINT "subscription_renewals_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
