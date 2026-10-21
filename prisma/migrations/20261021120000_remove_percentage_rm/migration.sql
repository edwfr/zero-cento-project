-- Safety net: prod had 0 rows on 2026-10-21; convert any leftover to absolute
UPDATE "workout_exercises"
SET "weightType" = 'absolute', "weight" = "effectiveWeight"
WHERE "weightType" = 'percentage_rm';

ALTER TYPE "WeightType" RENAME TO "WeightType_old";
CREATE TYPE "WeightType" AS ENUM ('absolute', 'percentage_1rm', 'percentage_previous');
ALTER TABLE "workout_exercises"
  ALTER COLUMN "weightType" TYPE "WeightType" USING ("weightType"::text::"WeightType");
DROP TYPE "WeightType_old";
