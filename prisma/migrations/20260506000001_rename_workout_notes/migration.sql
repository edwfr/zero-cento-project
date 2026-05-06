-- Rename workouts.notes → workouts.trainee_notes
-- The field was never written by any trainer API (always null in practice).
-- Rename makes ownership explicit: trainee-authored content.
ALTER TABLE "workouts" RENAME COLUMN "notes" TO "trainee_notes";
