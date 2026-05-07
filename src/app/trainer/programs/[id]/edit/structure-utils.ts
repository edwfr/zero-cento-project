export interface WorkoutStructureTemplateRow {
    id: string
    exerciseId: string
}

export interface SkeletonRow {
    dayIndex: number
    order: number
    exerciseId: string
}

const DEFAULT_EXERCISE_ROW_COUNT = 4

export function buildStructureRowsForWorkout(
    workoutIndex: number,
    skeletonRows: SkeletonRow[]
): WorkoutStructureTemplateRow[] {
    // Filter skeleton rows for this workout day index
    const rowsForWorkout = skeletonRows.filter((row) => row.dayIndex === workoutIndex)

    if (rowsForWorkout.length > 0) {
        return rowsForWorkout.map((row, rowIndex) => ({
            id: `structure-${workoutIndex}-skeleton-${row.order}`,
            exerciseId: row.exerciseId,
        }))
    }

    // Return 4 default empty rows if skeleton is empty
    return Array.from({ length: DEFAULT_EXERCISE_ROW_COUNT }, (_, i) => ({
        id: `structure-${workoutIndex}-default-${i}`,
        exerciseId: '',
    }))
}
