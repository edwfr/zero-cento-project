import { describe, it, expect } from 'vitest'
import { parseReps, isValidReps, plannedReps, repsSchema } from '@/lib/reps'

describe('parseReps', () => {
    it('parses single reps', () => {
        expect(parseReps('8')).toEqual({ kind: 'reps', min: 8, max: 8 })
    })
    it('parses a range', () => {
        expect(parseReps('8/10')).toEqual({ kind: 'reps', min: 8, max: 10 })
    })
    it('parses seconds', () => {
        expect(parseReps('30"')).toEqual({ kind: 'time', seconds: 30 })
    })
    it('parses amrap', () => {
        expect(parseReps('max')).toEqual({ kind: 'amrap' })
    })
    it.each(['', ' 8', '8 ', '8-10', '10/8', '8/8', '0', '51', '1/51', '0/5', '0"', '301"', '30/45"', 'MAX', '8/10/12', 'abc'])(
        'rejects %j',
        (value) => {
            expect(parseReps(value)).toBeNull()
        },
    )
    it('accepts boundaries', () => {
        expect(parseReps('50')).not.toBeNull()
        expect(parseReps('1/50')).not.toBeNull()
        expect(parseReps('300"')).not.toBeNull()
    })
})

describe('isValidReps', () => {
    it.each(['8', '8/10', '30"', 'max', '8-10', '', '51'])('matches parseReps for %j', (value) => {
        expect(isValidReps(value)).toBe(parseReps(value) !== null)
    })
})

describe('plannedReps', () => {
    it.each([
        ['8', 8],
        ['8/10', 8],
        ['30"', 0],
        ['max', 0],
        ['8-10', 0],
        ['', 0],
    ])('%j -> %i', (value, expected) => {
        expect(plannedReps(value)).toBe(expected)
    })
})

describe('repsSchema', () => {
    it('accepts a valid range', () => {
        expect(repsSchema.safeParse('8/10').success).toBe(true)
    })
    it('rejects a dash range with the i18n key', () => {
        const result = repsSchema.safeParse('8-10')
        expect(result.success).toBe(false)
        if (!result.success) expect(result.error.issues[0].message).toBe('validation.invalidReps')
    })
})
