-- AddColumn: isSkeletonExercise on workout_exercises
ALTER TABLE "workout_exercises" ADD COLUMN "is_skeleton_exercise" BOOLEAN NOT NULL DEFAULT false;
