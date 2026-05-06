import { describe, it, expect } from 'vitest'
import { computeExerciseStatus } from '@/lib/workout-recap'
import type { PrevWeekExerciseItem } from '@/lib/workout-recap'

describe('computeExerciseStatus', () => {
    it('returns done when workoutExercise isCompleted is true', () => {
        expect(computeExerciseStatus(true, false)).toBe('done')
    })

    it('returns done when workoutExercise isCompleted is true and at least one set is completed', () => {
        expect(computeExerciseStatus(true, true)).toBe('done')
    })

    it('returns not_started when workoutExercise isCompleted is false and no set is completed', () => {
        expect(computeExerciseStatus(false, false)).toBe('not_started')
    })

    it('returns in_progress when workoutExercise isCompleted is false and at least one set is completed', () => {
        expect(computeExerciseStatus(false, true)).toBe('in_progress')
    })
})

describe('PrevWeekExerciseItem type', () => {
    it('accepts a valid item with sets', () => {
        const item: PrevWeekExerciseItem = {
            id: 'we-1',
            exerciseName: 'Squat',
            order: 1,
            targetSets: 4,
            targetReps: '8',
            exerciseNote: null,
            sets: [{ setNumber: 1, reps: 8, weight: 100, completed: true }],
        }

        expect(item.sets).toHaveLength(1)
        expect(item.sets[0].weight).toBe(100)
    })

    it('accepts an item with empty sets (no feedback)', () => {
        const item: PrevWeekExerciseItem = {
            id: 'we-2',
            exerciseName: 'Row',
            order: 2,
            targetSets: 3,
            targetReps: '10',
            exerciseNote: null,
            sets: [],
        }

        expect(item.sets).toHaveLength(0)
    })
})