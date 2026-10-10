-- CreateTable
CREATE TABLE "macro_phase_types" (
    "id" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "macro_phase_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "macro_periods" (
    "id" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "phaseTypeId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "macro_periods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "macro_phase_types_trainerId_name_key" ON "macro_phase_types"("trainerId", "name");

-- CreateIndex
CREATE INDEX "macro_phase_types_trainerId_isActive_idx" ON "macro_phase_types"("trainerId", "isActive");

-- CreateIndex
CREATE INDEX "macro_periods_traineeId_startDate_idx" ON "macro_periods"("traineeId", "startDate");

-- CreateIndex
CREATE INDEX "macro_periods_trainerId_idx" ON "macro_periods"("trainerId");

-- AddForeignKey
ALTER TABLE "macro_phase_types" ADD CONSTRAINT "macro_phase_types_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "macro_periods" ADD CONSTRAINT "macro_periods_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "macro_periods" ADD CONSTRAINT "macro_periods_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "macro_periods" ADD CONSTRAINT "macro_periods_phaseTypeId_fkey" FOREIGN KEY ("phaseTypeId") REFERENCES "macro_phase_types"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
