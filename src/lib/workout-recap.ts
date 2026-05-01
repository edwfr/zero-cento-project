export type ExerciseStatus = 'not_started' | 'in_progress' | 'done'

export interface ExerciseRecapItem {
    id: string
    exerciseName: string
    order: number
    targetSets: number
    completedSets: number
    status: ExerciseStatus
}

export function computeExerciseStatus(
    totalSetsPerformed: number,
    completedSets: number,
    targetSets: number
): ExerciseStatus {
    if (totalSetsPerformed === 0) return 'not_started'
    if (completedSets >= targetSets) return 'done'
    return 'in_progress'
}