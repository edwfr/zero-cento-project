-- CreateTable
CREATE TABLE "workout_skeletons" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "dayIndex" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workout_skeletons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workout_skeletons_programId_dayIndex_order_key" ON "workout_skeletons"("programId", "dayIndex", "order");

-- CreateIndex
CREATE INDEX "workout_skeletons_programId_dayIndex_idx" ON "workout_skeletons"("programId", "dayIndex");

-- AddForeignKey
ALTER TABLE "workout_skeletons" ADD CONSTRAINT "workout_skeletons_programId_fkey" FOREIGN KEY ("programId") REFERENCES "training_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_skeletons" ADD CONSTRAINT "workout_skeletons_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: drop legacy skeleton flag
ALTER TABLE "workout_exercises" DROP COLUMN "isSkeletonExercise";
