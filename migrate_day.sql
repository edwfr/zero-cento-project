ALTER TABLE workouts ADD COLUMN IF NOT EXISTS "dayIndex" INTEGER;
UPDATE workouts SET "dayIndex" = CAST(REGEXP_REPLACE("dayLabel", '[^0-9]', '', 'g') AS INTEGER) WHERE "dayIndex" IS NULL;
ALTER TABLE workouts ALTER COLUMN "dayIndex" SET NOT NULL;
ALTER TABLE workouts DROP COLUMN IF EXISTS "dayLabel";
