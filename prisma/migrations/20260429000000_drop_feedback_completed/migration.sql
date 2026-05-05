-- Drop the redundant completed column from exercise_feedbacks.
-- After the atomic submit refactor, every feedback row represents a final submission,
-- making this flag always-true and redundant with workout_exercises.is_completed.

ALTER TABLE "exercise_feedbacks" DROP COLUMN "completed";
