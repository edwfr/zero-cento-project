export type ExerciseStatus = 'not_started' | 'in_progress' | 'done'

export interface SetRecap {
    setNumber: number
    reps: number
    weight: number
    completed: boolean
}

export interface ExerciseRecapItem {
    id: string
    exerciseName: string
    order: number
    targetSets: number
    completedSets: number
    reps: string
    effectiveWeight: number | null
    status: ExerciseStatus
    actualRpe: number | null
    exerciseNote: string | null
    sets: SetRecap[]
}

export function computeExerciseStatus(workoutExerciseCompleted: boolean, hasAnyCompletedSet: boolean): ExerciseStatus {
    if (workoutExerciseCompleted) return 'done'
    if (!hasAnyCompletedSet) return 'not_started'
    return 'in_progress'
}

export interface PrevWeekSet {
    setNumber: number
    reps: number
    weight: number
    completed: boolean
}

export interface PrevWeekExerciseItem {
    id: string
    exerciseName: string
    order: number
    targetSets: number
    targetReps: string
    exerciseNote: string | null
    sets: PrevWeekSet[]
}