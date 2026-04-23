export interface WorkoutStructureTemplateRow {
    id: string
    exerciseId: string
}

const DEFAULT_EXERCISE_ROW_COUNT = 4

export function buildStructureRowsForWorkout(
    workoutIndex: number,
    sourceExercises: Array<{ id: string; exercise: { id: string } }>
): WorkoutStructureTemplateRow[] {
    if (sourceExercises.length > 0) {
        return sourceExercises.map((we, rowIndex) => ({
            id: `structure-${workoutIndex}-${we.id}-${rowIndex}`,
            exerciseId: we.exercise.id,
        }))
    }
    return Array.from({ length: DEFAULT_EXERCISE_ROW_COUNT }, (_, i) => ({
        id: `structure-${workoutIndex}-default-${i}`,
        exerciseId: '',
    }))
}
