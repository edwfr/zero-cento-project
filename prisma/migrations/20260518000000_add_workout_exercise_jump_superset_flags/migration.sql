-- AlterTable
ALTER TABLE "workout_exercises"
ADD COLUMN "isJumpSet" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isSuperSet" BOOLEAN NOT NULL DEFAULT false;
