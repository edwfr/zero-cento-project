-- Unify reps range format: "8-10" -> "8/10" (the "/" form is the canonical one).
UPDATE "workout_exercises"
SET "reps" = replace("reps", '-', '/')
WHERE "reps" ~ '^\d+-\d+$';

UPDATE "workout_template_exercises"
SET "reps" = replace("reps", '-', '/')
WHERE "reps" ~ '^\d+-\d+$';
