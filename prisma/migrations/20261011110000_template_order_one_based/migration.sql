-- Template exercise order becomes 1-based, same convention as workout_exercises.
-- Two steps through negative values: a plain "order" + 1 can transiently collide
-- with the unique index on ("templateWorkoutId", "order").
UPDATE "workout_template_exercises"
SET "order" = -("order" + 1)
WHERE "templateWorkoutId" IN (
    SELECT "templateWorkoutId" FROM "workout_template_exercises" WHERE "order" = 0
);

UPDATE "workout_template_exercises"
SET "order" = -"order"
WHERE "order" < 0;

-- Programs created from a template copied the 0-based order into workout_exercises,
-- which the bulk save rejects (order >= 1). Shift those workouts to 1-based.
UPDATE "workout_exercises"
SET "order" = "order" + 1
WHERE "workoutId" IN (
    SELECT "workoutId" FROM "workout_exercises" WHERE "order" = 0
);
