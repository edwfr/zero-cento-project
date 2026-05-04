import { describe, it, expect } from 'vitest'
import { computeExerciseStatus } from '@/lib/workout-recap'
import type { PrevWeekExerciseItem } from '@/lib/workout-recap'

describe('computeExerciseStatus', () => {
    it('returns not_started when no sets completed', () => {
        expect(computeExerciseStatus(0, 4)).toBe('not_started')
    })

    it('returns done when completedSets equals targetSets', () => {
        expect(computeExerciseStatus(4, 4)).toBe('done')
    })

    it('returns done when completedSets exceeds targetSets', () => {
        expect(computeExerciseStatus(5, 4)).toBe('done')
    })

    it('returns in_progress when some sets are completed', () => {
        expect(computeExerciseStatus(2, 4)).toBe('in_progress')
    })

    it('returns not_started when sets exist but none completed (undo)', () => {
        expect(computeExerciseStatus(0, 4)).toBe('not_started')
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
            sets: [],
        }

        expect(item.sets).toHaveLength(0)
    })
})