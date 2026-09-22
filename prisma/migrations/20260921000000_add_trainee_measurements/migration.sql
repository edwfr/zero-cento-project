-- CreateEnum
CREATE TYPE "MeasurementMetric" AS ENUM ('weight', 'height', 'chest', 'arm', 'waist', 'hips', 'thigh', 'calf');

-- CreateTable
CREATE TABLE "trainee_measurements" (
    "id" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "metric" "MeasurementMetric" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "measuredAt" DATE NOT NULL,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trainee_measurements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trainee_measurements_traineeId_metric_measuredAt_key" ON "trainee_measurements"("traineeId", "metric", "measuredAt");

-- CreateIndex
CREATE INDEX "trainee_measurements_traineeId_measuredAt_idx" ON "trainee_measurements"("traineeId", "measuredAt");

-- AddForeignKey
ALTER TABLE "trainee_measurements" ADD CONSTRAINT "trainee_measurements_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainee_measurements" ADD CONSTRAINT "trainee_measurements_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
