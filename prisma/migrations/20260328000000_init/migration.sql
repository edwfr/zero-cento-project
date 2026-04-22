-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'trainer', 'trainee');

-- CreateEnum
CREATE TYPE "ExerciseType" AS ENUM ('fundamental', 'accessory');

-- CreateEnum
CREATE TYPE "ProgramStatus" AS ENUM ('draft', 'active', 'completed');

-- CreateEnum
CREATE TYPE "WeekType" AS ENUM ('normal', 'test', 'deload');

-- CreateEnum
CREATE TYPE "WeightType" AS ENUM ('absolute', 'percentage_1rm', 'percentage_rm', 'percentage_previous');

-- CreateEnum
CREATE TYPE "RestTime" AS ENUM ('s30', 'm1', 'm2', 'm3', 'm5');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trainer_trainee" (
    "id" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trainer_trainee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "muscle_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "muscle_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movement_patterns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "movement_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movement_pattern_colors" (
    "id" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "movementPatternId" TEXT NOT NULL,
    "color" TEXT NOT NULL,

    CONSTRAINT "movement_pattern_colors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercises" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "youtubeUrl" TEXT,
    "type" "ExerciseType" NOT NULL,
    "movementPatternId" TEXT NOT NULL,
    "notes" TEXT[],
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise_muscle_groups" (
    "id" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "muscleGroupId" TEXT NOT NULL,
    "coefficient" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "exercise_muscle_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_programs" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "isSbdProgram" BOOLEAN NOT NULL DEFAULT false,
    "startDate" TIMESTAMP(3),
    "durationWeeks" INTEGER NOT NULL,
    "workoutsPerWeek" INTEGER NOT NULL,
    "status" "ProgramStatus" NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weeks" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3),
    "weekType" "WeekType" NOT NULL DEFAULT 'normal',
    "feedbackRequested" BOOLEAN NOT NULL DEFAULT false,
    "generalFeedback" TEXT,

    CONSTRAINT "weeks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workouts" (
    "id" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "dayIndex" INTEGER NOT NULL,
    "notes" TEXT,

    CONSTRAINT "workouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_exercises" (
    "id" TEXT NOT NULL,
    "workoutId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "variant" TEXT,
    "sets" INTEGER NOT NULL,
    "reps" TEXT NOT NULL,
    "targetRpe" DOUBLE PRECISION,
    "weightType" "WeightType" NOT NULL,
    "weight" DOUBLE PRECISION,
    "effectiveWeight" DOUBLE PRECISION,
    "restTime" "RestTime" NOT NULL,
    "isWarmup" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "order" INTEGER NOT NULL,

    CONSTRAINT "workout_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise_feedbacks" (
    "id" TEXT NOT NULL,
    "workoutExerciseId" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "actualRpe" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exercise_feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sets_performed" (
    "id" TEXT NOT NULL,
    "feedbackId" TEXT NOT NULL,
    "setNumber" INTEGER NOT NULL,
    "reps" INTEGER NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sets_performed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personal_records" (
    "id" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "reps" INTEGER NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "recordDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "personal_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_isActive_idx" ON "users"("role", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "trainer_trainee_traineeId_key" ON "trainer_trainee"("traineeId");

-- CreateIndex
CREATE INDEX "trainer_trainee_trainerId_idx" ON "trainer_trainee"("trainerId");

-- CreateIndex
CREATE UNIQUE INDEX "muscle_groups_name_key" ON "muscle_groups"("name");

-- CreateIndex
CREATE INDEX "muscle_groups_isActive_idx" ON "muscle_groups"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "movement_patterns_name_key" ON "movement_patterns"("name");

-- CreateIndex
CREATE INDEX "movement_patterns_isActive_idx" ON "movement_patterns"("isActive");

-- CreateIndex
CREATE INDEX "movement_pattern_colors_trainerId_idx" ON "movement_pattern_colors"("trainerId");

-- CreateIndex
CREATE UNIQUE INDEX "movement_pattern_colors_trainerId_movementPatternId_key" ON "movement_pattern_colors"("trainerId", "movementPatternId");

-- CreateIndex
CREATE INDEX "exercises_type_idx" ON "exercises"("type");

-- CreateIndex
CREATE INDEX "exercises_movementPatternId_idx" ON "exercises"("movementPatternId");

-- CreateIndex
CREATE INDEX "exercises_name_idx" ON "exercises"("name");

-- CreateIndex
CREATE INDEX "exercise_muscle_groups_exerciseId_idx" ON "exercise_muscle_groups"("exerciseId");

-- CreateIndex
CREATE INDEX "exercise_muscle_groups_muscleGroupId_idx" ON "exercise_muscle_groups"("muscleGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "exercise_muscle_groups_exerciseId_muscleGroupId_key" ON "exercise_muscle_groups"("exerciseId", "muscleGroupId");

-- CreateIndex
CREATE INDEX "training_programs_trainerId_status_idx" ON "training_programs"("trainerId", "status");

-- CreateIndex
CREATE INDEX "training_programs_traineeId_status_idx" ON "training_programs"("traineeId", "status");

-- CreateIndex
CREATE INDEX "training_programs_status_startDate_idx" ON "training_programs"("status", "startDate");

-- CreateIndex
CREATE INDEX "weeks_programId_weekNumber_idx" ON "weeks"("programId", "weekNumber");

-- CreateIndex
CREATE INDEX "weeks_startDate_idx" ON "weeks"("startDate");

-- CreateIndex
CREATE INDEX "workouts_weekId_idx" ON "workouts"("weekId");

-- CreateIndex
CREATE INDEX "workout_exercises_workoutId_order_idx" ON "workout_exercises"("workoutId", "order");

-- CreateIndex
CREATE INDEX "workout_exercises_exerciseId_idx" ON "workout_exercises"("exerciseId");

-- CreateIndex
CREATE INDEX "exercise_feedbacks_traineeId_date_idx" ON "exercise_feedbacks"("traineeId", "date");

-- CreateIndex
CREATE INDEX "exercise_feedbacks_workoutExerciseId_idx" ON "exercise_feedbacks"("workoutExerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "exercise_feedbacks_workoutExerciseId_traineeId_date_key" ON "exercise_feedbacks"("workoutExerciseId", "traineeId", "date");

-- CreateIndex
CREATE INDEX "sets_performed_feedbackId_idx" ON "sets_performed"("feedbackId");

-- CreateIndex
CREATE UNIQUE INDEX "sets_performed_feedbackId_setNumber_key" ON "sets_performed"("feedbackId", "setNumber");

-- CreateIndex
CREATE INDEX "personal_records_traineeId_exerciseId_idx" ON "personal_records"("traineeId", "exerciseId");

-- CreateIndex
CREATE INDEX "personal_records_recordDate_idx" ON "personal_records"("recordDate");

-- AddForeignKey
ALTER TABLE "trainer_trainee" ADD CONSTRAINT "trainer_trainee_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainer_trainee" ADD CONSTRAINT "trainer_trainee_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "muscle_groups" ADD CONSTRAINT "muscle_groups_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movement_patterns" ADD CONSTRAINT "movement_patterns_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movement_pattern_colors" ADD CONSTRAINT "movement_pattern_colors_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movement_pattern_colors" ADD CONSTRAINT "movement_pattern_colors_movementPatternId_fkey" FOREIGN KEY ("movementPatternId") REFERENCES "movement_patterns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_movementPatternId_fkey" FOREIGN KEY ("movementPatternId") REFERENCES "movement_patterns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_muscle_groups" ADD CONSTRAINT "exercise_muscle_groups_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_muscle_groups" ADD CONSTRAINT "exercise_muscle_groups_muscleGroupId_fkey" FOREIGN KEY ("muscleGroupId") REFERENCES "muscle_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_programs" ADD CONSTRAINT "training_programs_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_programs" ADD CONSTRAINT "training_programs_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weeks" ADD CONSTRAINT "weeks_programId_fkey" FOREIGN KEY ("programId") REFERENCES "training_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "weeks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_exercises" ADD CONSTRAINT "workout_exercises_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "workouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_exercises" ADD CONSTRAINT "workout_exercises_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_feedbacks" ADD CONSTRAINT "exercise_feedbacks_workoutExerciseId_fkey" FOREIGN KEY ("workoutExerciseId") REFERENCES "workout_exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_feedbacks" ADD CONSTRAINT "exercise_feedbacks_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sets_performed" ADD CONSTRAINT "sets_performed_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "exercise_feedbacks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_records" ADD CONSTRAINT "personal_records_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_records" ADD CONSTRAINT "personal_records_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

