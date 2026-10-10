-- CreateEnum
CREATE TYPE "RenewalKind" AS ENUM ('period', 'programs');

-- CreateEnum
CREATE TYPE "SubscriptionEventType" AS ENUM ('period_renewal_created', 'package_created', 'renewal_updated', 'renewal_deleted', 'credit_consumed', 'credit_refunded', 'credit_forfeited');

-- AlterTable: existing rows are period renewals (column default), no backfill needed
ALTER TABLE "subscription_renewals"
    ADD COLUMN "kind" "RenewalKind" NOT NULL DEFAULT 'period',
    ADD COLUMN "programCount" INTEGER,
    ALTER COLUMN "durationMonths" DROP NOT NULL,
    ALTER COLUMN "endDate" DROP NOT NULL;

-- A row carries the fields of its own kind only
ALTER TABLE "subscription_renewals" ADD CONSTRAINT "subscription_renewals_kind_fields_check" CHECK (
    ("kind" = 'period' AND "durationMonths" IS NOT NULL AND "endDate" IS NOT NULL AND "programCount" IS NULL)
    OR
    ("kind" = 'programs' AND "programCount" IS NOT NULL AND "durationMonths" IS NULL AND "endDate" IS NULL)
);

-- CreateIndex
CREATE INDEX "subscription_renewals_traineeId_createdAt_idx" ON "subscription_renewals"("traineeId", "createdAt");

-- CreateTable
CREATE TABLE "program_credit_usages" (
    "id" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "programId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "program_credit_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_events" (
    "id" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "type" "SubscriptionEventType" NOT NULL,
    "creditDelta" INTEGER,
    "renewalId" TEXT,
    "programId" TEXT,
    "details" JSONB NOT NULL,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "program_credit_usages_programId_key" ON "program_credit_usages"("programId");

-- CreateIndex
CREATE INDEX "program_credit_usages_traineeId_idx" ON "program_credit_usages"("traineeId");

-- CreateIndex
CREATE INDEX "subscription_events_traineeId_createdAt_idx" ON "subscription_events"("traineeId", "createdAt");

-- AddForeignKey
ALTER TABLE "program_credit_usages" ADD CONSTRAINT "program_credit_usages_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_credit_usages" ADD CONSTRAINT "program_credit_usages_programId_fkey" FOREIGN KEY ("programId") REFERENCES "training_programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_credit_usages" ADD CONSTRAINT "program_credit_usages_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
