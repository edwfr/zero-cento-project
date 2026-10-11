-- CreateTable
CREATE TABLE "workout_templates" (
    "id" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "workoutsPerWeek" INTEGER NOT NULL,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workout_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_template_workouts" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "dayIndex" INTEGER NOT NULL,

    CONSTRAINT "workout_template_workouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_template_exercises" (
    "id" TEXT NOT NULL,
    "templateWorkoutId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "sets" INTEGER NOT NULL,
    "reps" TEXT NOT NULL,
    "restTime" "RestTime" NOT NULL,

    CONSTRAINT "workout_template_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workout_templates_trainerId_idx" ON "workout_templates"("trainerId");

-- CreateIndex
CREATE UNIQUE INDEX "workout_template_workouts_templateId_dayIndex_key" ON "workout_template_workouts"("templateId", "dayIndex");

-- CreateIndex
CREATE INDEX "workout_template_exercises_exerciseId_idx" ON "workout_template_exercises"("exerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "workout_template_exercises_templateWorkoutId_order_key" ON "workout_template_exercises"("templateWorkoutId", "order");

-- AddForeignKey
ALTER TABLE "workout_templates" ADD CONSTRAINT "workout_templates_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_template_workouts" ADD CONSTRAINT "workout_template_workouts_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "workout_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_template_exercises" ADD CONSTRAINT "workout_template_exercises_templateWorkoutId_fkey" FOREIGN KEY ("templateWorkoutId") REFERENCES "workout_template_workouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_template_exercises" ADD CONSTRAINT "workout_template_exercises_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

