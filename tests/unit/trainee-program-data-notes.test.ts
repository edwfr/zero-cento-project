import { describe, it, expect } from 'vitest'

describe('WorkoutEntry traineeNote field', () => {
    it('exercisesPerformed items include traineeNote field', () => {
        type ExercisePerformedItem = {
            workoutExerciseId: string
            performedSets: Array<{ setNumber: number; reps: number; weight: number }>
            traineeNote: string | null
        }

        const item: ExercisePerformedItem = {
            workoutExerciseId: 'we-1',
            performedSets: [{ setNumber: 1, reps: 8, weight: 80 }],
            traineeNote: 'felt strong',
        }

        expect(item.traineeNote).toBe('felt strong')

        const itemNoNote: ExercisePerformedItem = {
            workoutExerciseId: 'we-2',
            performedSets: [],
            traineeNote: null,
        }

        expect(itemNoNote.traineeNote).toBeNull()
    })
})
