export function computeExerciseGroupColors(
    rows: { id: string; exerciseId: string }[]
): Map<string, 'even' | 'odd'> {
    const result = new Map<string, 'even' | 'odd'>()
    let groupIndex = -1
    let prevExerciseId = ''

    for (const row of rows) {
        if (!row.exerciseId) continue
        if (row.exerciseId !== prevExerciseId) {
            groupIndex++
            prevExerciseId = row.exerciseId
        }
        result.set(row.id, groupIndex % 2 === 0 ? 'even' : 'odd')
    }

    return result
}
