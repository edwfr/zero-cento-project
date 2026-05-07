import { describe, it, expect } from 'vitest'
import { hydrateDraftRowsForWorkout, type SkeletonRow } from '@/app/trainer/programs/[id]/edit/skeleton-hydration'

describe('hydrateDraftRowsForWorkout', () => {
    const mockWorkoutId = 'workout-1'
    const mockSkeletonRow1 = { dayIndex: 0, order: 0, exerciseId: 'ex-1' }
    const mockSkeletonRow2 = { dayIndex: 0, order: 1, exerciseId: 'ex-2' }

    it('returns empty array when existingExerciseCount > 0', () => {
        const result = hydrateDraftRowsForWorkout({
            workoutId: mockWorkoutId,
            skeletonForDay: [mockSkeletonRow1, mockSkeletonRow2],
            existingExerciseCount: 1,
            startingOrder: 0,
        })
        expect(result).toHaveLength(0)
    })

    it('returns empty array when skeletonForDay is empty', () => {
        const result = hydrateDraftRowsForWorkout({
            workoutId: mockWorkoutId,
            skeletonForDay: [],
            existingExerciseCount: 0,
            startingOrder: 0,
        })
        expect(result).toHaveLength(0)
    })

    it('hydrates draft rows from skeleton', () => {
        const result = hydrateDraftRowsForWorkout({
            workoutId: mockWorkoutId,
            skeletonForDay: [mockSkeletonRow1, mockSkeletonRow2],
            existingExerciseCount: 0,
            startingOrder: 0,
        })
        expect(result).toHaveLength(2)
        expect(result[0]).toMatchObject({
            exerciseId: 'ex-1',
            sets: 0,
            reps: '',
            weightType: 'absolute',
            weight: null,
            isDraft: true,
        })
        expect(result[1]).toMatchObject({
            exerciseId: 'ex-2',
            sets: 0,
            reps: '',
            weightType: 'absolute',
            weight: null,
            isDraft: true,
        })
    })

    it('respects startingOrder for draft row ordering', () => {
        const result = hydrateDraftRowsForWorkout({
            workoutId: mockWorkoutId,
            skeletonForDay: [mockSkeletonRow1, mockSkeletonRow2],
            existingExerciseCount: 0,
            startingOrder: 5,
        })
        expect(result[0].order).toBe(5)
        expect(result[1].order).toBe(6)
    })
})
