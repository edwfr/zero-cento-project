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

export interface EditableWorkoutExerciseRowLike {
    id: string
    workoutId: string
    exerciseId: string
    variant: string
    sets: string
    reps: string
    targetRpe: string
    weight: string
    isWarmup: boolean
    isJumpSet: boolean
    isSuperSet: boolean
    order: number
    restTime: string
    notes: string | null
    isDraft: boolean
}

export function duplicateEditableWorkoutExerciseRow<T extends EditableWorkoutExerciseRowLike>({
    orderedRows,
    sourceRowId,
    duplicatedRowId,
}: {
    orderedRows: T[]
    sourceRowId: string
    duplicatedRowId: string
}): { duplicatedRow: T; shiftedRows: T[] } | null {
    const sourceRow = orderedRows.find((row) => row.id === sourceRowId)

    if (!sourceRow) {
        return null
    }

    const insertAtOrder = sourceRow.order + 1

    const shiftedRows = orderedRows
        .filter((row) => row.order >= insertAtOrder)
        .map((row) => ({
            ...row,
            order: row.order + 1,
        }))

    const duplicatedRow = {
        ...sourceRow,
        id: duplicatedRowId,
        order: insertAtOrder,
        isDraft: true,
    }

    return {
        duplicatedRow,
        shiftedRows,
    }
}

export function mergeDirtyPersistedRows<T extends EditableWorkoutExerciseRowLike>({
    serverRowsById,
    currentRowsById,
    dirtyPersistedRowIds,
}: {
    serverRowsById: Record<string, T>
    currentRowsById: Record<string, T>
    dirtyPersistedRowIds: ReadonlySet<string>
}): Record<string, T> {
    if (dirtyPersistedRowIds.size === 0) {
        return serverRowsById
    }

    const mergedRowsById = { ...serverRowsById }

    dirtyPersistedRowIds.forEach((rowId) => {
        const serverRow = serverRowsById[rowId]
        const currentRow = currentRowsById[rowId]

        if (!serverRow || !currentRow || currentRow.isDraft) {
            return
        }

        mergedRowsById[rowId] = {
            ...serverRow,
            exerciseId: currentRow.exerciseId,
            variant: currentRow.variant,
            sets: currentRow.sets,
            reps: currentRow.reps,
            targetRpe: currentRow.targetRpe,
            weight: currentRow.weight,
            isWarmup: currentRow.isWarmup,
            isJumpSet: currentRow.isJumpSet,
            isSuperSet: currentRow.isSuperSet,
            order: currentRow.order,
            restTime: currentRow.restTime,
            notes: currentRow.notes,
        }
    })

    return mergedRowsById
}

export function pruneMissingDirtyRowIds(
    dirtyPersistedRowIds: ReadonlySet<string>,
    existingRowIds: ReadonlySet<string>
): Set<string> {
    const nextDirtyPersistedRowIds = new Set<string>()

    dirtyPersistedRowIds.forEach((rowId) => {
        if (existingRowIds.has(rowId)) {
            nextDirtyPersistedRowIds.add(rowId)
        }
    })

    return nextDirtyPersistedRowIds
}
