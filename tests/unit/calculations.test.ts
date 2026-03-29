import { describe, it, expect } from 'vitest'
import {
    calculateVolume,
    calculateTrainingSets,
    parseReps,
    estimateOneRM,
} from '@/lib/calculations'

describe('calculateVolume', () => {
    it('returns sets × reps × weight × coefficient', () => {
        expect(calculateVolume(3, 8, 100, 1)).toBe(2400)
    })

    it('applies fractional coefficient correctly', () => {
        expect(calculateVolume(4, 10, 80, 0.5)).toBe(1600)
    })

    it('returns 0 when weight is 0', () => {
        expect(calculateVolume(3, 8, 0, 1)).toBe(0)
    })

    it('returns 0 when coefficient is 0', () => {
        expect(calculateVolume(3, 8, 100, 0)).toBe(0)
    })
})

describe('calculateTrainingSets', () => {
    it('returns 0 for warmup sets', () => {
        expect(calculateTrainingSets(3, 1, true)).toBe(0)
    })

    it('returns sets × coefficient for non-warmup', () => {
        expect(calculateTrainingSets(4, 0.75, false)).toBe(3)
    })

    it('returns sets × 1 for full-contribution exercise', () => {
        expect(calculateTrainingSets(5, 1, false)).toBe(5)
    })

    it('still returns 0 for warmup even with coefficient', () => {
        expect(calculateTrainingSets(3, 0.5, true)).toBe(0)
    })
})

describe('parseReps', () => {
    it('parses simple integer string', () => {
        expect(parseReps('8')).toBe(8)
    })

    it('parses range "8-10" and returns first number', () => {
        expect(parseReps('8-10')).toBe(8)
    })

    it('parses slash format "6/8" and returns first number', () => {
        expect(parseReps('6/8')).toBe(6)
    })

    it('returns 0 for empty string', () => {
        expect(parseReps('')).toBe(0)
    })

    it('returns 0 for non-numeric string', () => {
        expect(parseReps('AMRAP')).toBe(0)
    })

    it('parses "12" correctly', () => {
        expect(parseReps('12')).toBe(12)
    })
})

describe('estimateOneRM', () => {
    it('returns weight directly when reps = 1', () => {
        expect(estimateOneRM(100, 1)).toBe(100)
    })

    it('uses Epley formula: weight × (1 + reps/30)', () => {
        // 100 × (1 + 10/30) = 100 × 1.333... ≈ 133.33
        expect(estimateOneRM(100, 10)).toBeCloseTo(133.33, 1)
    })

    it('handles reps = 5 correctly', () => {
        // 80 × (1 + 5/30) = 80 × 1.1667 ≈ 93.33
        expect(estimateOneRM(80, 5)).toBeCloseTo(93.33, 1)
    })

    it('returns higher estimate for more reps at same weight', () => {
        const light = estimateOneRM(100, 3)
        const heavy = estimateOneRM(100, 12)
        expect(heavy).toBeGreaterThan(light)
    })
})
