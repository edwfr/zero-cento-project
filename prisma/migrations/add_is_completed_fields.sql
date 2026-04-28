-- Migration: Add isCompleted fields to workout_exercises, workouts, weeks
-- Date: 2026-04-28
-- Run manually via Supabase Dashboard > SQL Editor

-- 1. workout_exercises
ALTER TABLE "workout_exercises"
  ADD COLUMN IF NOT EXISTS "isCompleted" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "workout_exercises_workoutId_isCompleted_idx"
  ON "workout_exercises" ("workoutId", "isCompleted");

-- 2. workouts
ALTER TABLE "workouts"
  ADD COLUMN IF NOT EXISTS "isCompleted" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "workouts_weekId_isCompleted_idx"
  ON "workouts" ("weekId", "isCompleted");

-- 3. weeks
ALTER TABLE "weeks"
  ADD COLUMN IF NOT EXISTS "isCompleted" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "weeks_programId_isCompleted_idx"
  ON "weeks" ("programId", "isCompleted");
