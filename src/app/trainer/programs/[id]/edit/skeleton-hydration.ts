export interface SkeletonRow {
    dayIndex: number
    order: number
    exerciseId: string
}

export interface HydratedDraftRow {
    id: string
    workoutId: string
    exerciseId: string
    variant: null
    sets: number
    reps: string
    targetRpe: null
    weightType: 'absolute'
    weight: null
    effectiveWeight: null
    restTime: 'm2'
    isWarmup: boolean
    isJumpSet: boolean
    isSuperSet: boolean
    notes: null
    order: number
    isDraft: true
}

export interface HydrateInput {
    workoutId: string
    skeletonForDay: SkeletonRow[]
    existingExerciseCount: number
    startingOrder: number
}

/**
 * Hydrates draft rows for a workout based on skeleton template
 * - If workout already has exercises (existingExerciseCount > 0), returns empty (don't hydrate over saved data)
 * - If skeleton is empty, returns empty (no template to hydrate from)
 * - Otherwise, creates draft rows from skeleton with sparse fields
 */
export function hydrateDraftRowsForWorkout({
    workoutId,
    skeletonForDay,
    existingExerciseCount,
    startingOrder,
}: HydrateInput): HydratedDraftRow[] {
    // Skip hydration if workout already has saved exercises
    if (existingExerciseCount > 0) {
        return []
    }

    // Skip hydration if skeleton is empty
    if (skeletonForDay.length === 0) {
        return []
    }

    // Create draft rows from skeleton
    return skeletonForDay.map((skeletonRow, index) => ({
        id: `draft-${workoutId}-${skeletonRow.exerciseId}-${index}`,
        workoutId,
        exerciseId: skeletonRow.exerciseId,
        variant: null,
        sets: 0,
        reps: '',
        targetRpe: null,
        weightType: 'absolute' as const,
        weight: null,
        effectiveWeight: null,
        restTime: 'm2' as const,
        isWarmup: false,
        isJumpSet: false,
        isSuperSet: false,
        notes: null,
        order: startingOrder + index,
        isDraft: true as const,
    }))
}
