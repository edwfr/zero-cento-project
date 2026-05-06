-- Migration: Expand WeekType enum
-- Adds 6 new training phase types; removes 'normal'; migrates normal → volume

-- Step 1: Create new enum with all target values
CREATE TYPE "WeekType_new" AS ENUM (
  'tecnica',
  'ipertrofia',
  'volume',
  'forza_generale',
  'intensificazione',
  'picco',
  'test',
  'deload'
);

-- Step 2: Drop the column default (it references the old enum type)
ALTER TABLE "weeks" ALTER COLUMN "weekType" DROP DEFAULT;

-- Step 3: Cast column to new enum, migrating 'normal' → 'volume'
ALTER TABLE "weeks"
  ALTER COLUMN "weekType" TYPE "WeekType_new"
  USING (
    CASE "weekType"::text
      WHEN 'normal' THEN 'volume'
      ELSE "weekType"::text
    END
  )::"WeekType_new";

-- Step 4: Drop old enum
DROP TYPE "WeekType";

-- Step 5: Rename new enum to original name
ALTER TYPE "WeekType_new" RENAME TO "WeekType";

-- Step 6: Restore column default
ALTER TABLE "weeks" ALTER COLUMN "weekType" SET DEFAULT 'volume';
