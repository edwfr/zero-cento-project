import type { RestTime, WeightType } from '@prisma/client'

export interface TemplateWorkoutLike {
    dayIndex: number
    exercises: { exerciseId: string; order: number; sets: number; reps: string; restTime: RestTime }[]
}

/** Program Workout reference; dayIndex is 1-based. */
export interface Week1WorkoutRef {
    id: string
    dayIndex: number
}

export interface Week1ExerciseRow {
    workoutId: string
    exerciseId: string
    order: number
    sets: number
    reps: string
    restTime: RestTime
    weightType: WeightType
    weight: null
    effectiveWeight: null
    targetRpe: null
    variant: null
    notes: null
    isWarmup: false
    isJumpSet: false
    isSuperSet: false
    isCompleted: false
}

export interface SkeletonRowData {
    programId: string
    dayIndex: number
    order: number
    exerciseId: string
}

export function countTemplateExercises(workouts: TemplateWorkoutLike[]): number {
    return workouts.reduce((sum, w) => sum + w.exercises.length, 0)
}

/** Template day d (0-based) maps to program Week 1 workout with dayIndex d + 1. */
export function buildWeek1ExerciseRows(
    workouts: TemplateWorkoutLike[],
    week1Workouts: Week1WorkoutRef[]
): Week1ExerciseRow[] {
    const rows: Week1ExerciseRow[] = []
    for (const workout of workouts) {
        const target = week1Workouts.find((w) => w.dayIndex === workout.dayIndex + 1)
        if (!target) {
            throw new Error(`Week 1 workout not found for dayIndex ${workout.dayIndex}`)
        }
        for (const ex of workout.exercises) {
            rows.push({
                workoutId: target.id,
                exerciseId: ex.exerciseId,
                order: ex.order,
                sets: ex.sets,
                reps: ex.reps,
                restTime: ex.restTime,
                weightType: 'absolute',
                weight: null,
                effectiveWeight: null,
                targetRpe: null,
                variant: null,
                notes: null,
                isWarmup: false,
                isJumpSet: false,
                isSuperSet: false,
                isCompleted: false,
            })
        }
    }
    return rows
}

/** Skeleton dayIndex stays 0-based, same as the template. */
export function buildSkeletonRows(
    programId: string,
    workouts: TemplateWorkoutLike[]
): SkeletonRowData[] {
    return workouts.flatMap((w) =>
        w.exercises.map((ex) => ({
            programId,
            dayIndex: w.dayIndex,
            order: ex.order,
            exerciseId: ex.exerciseId,
        }))
    )
}
