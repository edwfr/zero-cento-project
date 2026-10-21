import { describe, expect, it } from 'vitest'
import { latestNormalizedOneRMByExercise } from '@/lib/calculations'
import {
    formatWeightRange,
    percentageOfOneRmWeight,
    percentageOfPreviousWeight,
    roundWeightValue,
} from '@/lib/weight-rounding'

const EX_1 = 'exercise-1'
const PR_OLD_HIGH = { exerciseId: EX_1, reps: 1, weight: 150, recordDate: new Date('2026-06-01') }
const PR_RECENT = { exerciseId: EX_1, reps: 5, weight: 120, recordDate: new Date('2026-09-30') }

describe('roundWeightValue', () => {
    it('ceils to the next 0.5 kg', () => {
        expect(roundWeightValue(104.25)).toBe(104.5)
        expect(roundWeightValue(104.5)).toBe(104.5)
        expect(roundWeightValue(104.51)).toBe(105)
    })

    it('ignores floating-point noise before ceiling', () => {
        expect(roundWeightValue(100.00000001)).toBe(100)
    })
})

describe('percentageOfOneRmWeight', () => {
    it('uses the latest PR, not the heaviest, as the 1RM base', () => {
        // Trainer edit/workout pages build their 1RM map this way.
        const oneRm = latestNormalizedOneRMByExercise([PR_OLD_HIGH, PR_RECENT])[EX_1]

        expect(percentageOfOneRmWeight(oneRm, 75)).toBe(104.5)
    })
})

describe('percentageOfPreviousWeight', () => {
    it('applies a negative percentage to the previous weight and rounds', () => {
        expect(percentageOfPreviousWeight(100, -5)).toBe(95)
        expect(percentageOfPreviousWeight(97, -10)).toBe(87.5)
    })
})

describe('formatWeightRange', () => {
    it('joins bounds with an en dash, no spaces, no unit', () => {
        expect(formatWeightRange(110.5, 115)).toBe('110.5–115')
        expect(formatWeightRange(100, 102)).toBe('100–102')
    })
})
