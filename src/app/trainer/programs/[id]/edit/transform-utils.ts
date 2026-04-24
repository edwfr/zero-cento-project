/**
 * Pure transform helpers: API JSON response → local Program/Week state shape.
 *
 * Extracted from _content.tsx so that:
 * 1. fetchProgram() can reuse the same logic.
 * 2. handleCopyWeekToNext() can apply the returned `updatedWeek` to local
 *    React state without triggering a full GET /api/programs/{id} re-fetch.
 */

const PRIMARY_COLOR = 'rgb(var(--brand-primary))'

export function transformApiExercise(we: any, trainerId: string): any {
    const movementPattern = we.exercise?.movementPattern
        ? {
            id: we.exercise.movementPattern.id,
            name: we.exercise.movementPattern.name,
            color:
                we.exercise.movementPattern.movementPatternColors?.find(
                    (c: any) => c.trainerId === trainerId
                )?.color || PRIMARY_COLOR,
        }
        : null

    return {
        id: we.id,
        order: we.order,
        variant: we.variant,
        sets: we.sets,
        reps: String(we.reps),
        targetRpe: we.targetRpe,
        weightType: we.weightType,
        weight: we.weight,
        effectiveWeight: we.effectiveWeight,
        restTime: we.restTime,
        isWarmup: we.isWarmup,
        notes: we.notes,
        exercise: {
            id: we.exercise.id,
            name: we.exercise.name,
            type: we.exercise.type,
            notes: Array.isArray(we.exercise.notes)
                ? we.exercise.notes.filter((note: unknown) => typeof note === 'string')
                : [],
            movementPattern,
            exerciseMuscleGroups: we.exercise.exerciseMuscleGroups || [],
        },
    }
}

export function transformApiWeek(week: any, trainerId: string): any {
    return {
        id: week.id,
        weekNumber: week.weekNumber,
        weekType: week.weekType,
        workouts: (week.workouts || [])
            .map((workout: any) => ({
                id: workout.id,
                dayIndex:
                    typeof workout.dayIndex === 'number'
                        ? workout.dayIndex
                        : Number(workout.dayOfWeek ?? 0),
                workoutExercises: (workout.workoutExercises || []).map((we: any) =>
                    transformApiExercise(we, trainerId)
                ),
            }))
            .sort((a: any, b: any) => a.dayIndex - b.dayIndex),
    }
}
