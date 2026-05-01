import { describe, it, expect } from 'vitest'
import { computeExerciseStatus } from '@/lib/workout-recap'

describe('computeExerciseStatus', () => {
    it('returns not_started when no sets performed', () => {
        expect(computeExerciseStatus(0, 0, 4)).toBe('not_started')
    })

    it('returns done when completedSets equals targetSets', () => {
        expect(computeExerciseStatus(4, 4, 4)).toBe('done')
    })

    it('returns done when completedSets exceeds targetSets', () => {
        expect(computeExerciseStatus(5, 5, 4)).toBe('done')
    })

    it('returns in_progress when some sets are completed', () => {
        expect(computeExerciseStatus(3, 2, 4)).toBe('in_progress')
    })

    it('returns in_progress when sets performed but none completed', () => {
        expect(computeExerciseStatus(2, 0, 4)).toBe('in_progress')
    })
})