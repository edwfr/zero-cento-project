import { describe, it, expect } from 'vitest'
import { checkReps, parseReps, isValidReps, plannedReps, repsSchema } from '@/lib/reps'

describe('parseReps', () => {
    it('parses single reps', () => {
        expect(parseReps('8')).toEqual({ kind: 'reps', min: 8, max: 8 })
    })
    it('parses a range', () => {
        expect(parseReps('8/10')).toEqual({ kind: 'reps', min: 8, max: 10 })
    })
    it('parses seconds', () => {
        expect(parseReps('30"')).toEqual({ kind: 'time', min: 30, max: 30 })
    })
    it('parses a seconds range', () => {
        expect(parseReps('30"/45"')).toEqual({ kind: 'time', min: 30, max: 45 })
    })
    it('parses amrap', () => {
        expect(parseReps('max')).toEqual({ kind: 'amrap' })
    })
    it.each(['', ' 8', '8 ', '8-10', '10/8', '8/8', '0', '51', '1/51', '0/5', '0"', '301"', '30/45"', '30"/45', '45"/30"', '30"/30"', '0"/30"', '30"/301"', '30"-45"', 'MAX', '8/10/12', 'abc'])(
        'rejects %j',
        (value) => {
            expect(parseReps(value)).toBeNull()
        },
    )
    it('accepts boundaries', () => {
        expect(parseReps('50')).not.toBeNull()
        expect(parseReps('1/50')).not.toBeNull()
        expect(parseReps('300"')).not.toBeNull()
        expect(parseReps('1"/300"')).not.toBeNull()
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
        ['30"/45"', 0],
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
    it('carries the seconds suggestion in the issue params', () => {
        const result = repsSchema.safeParse('60')
        expect(result.success).toBe(false)
        if (!result.success) {
            const issue = result.error.issues[0]
            expect(issue.message).toBe('validation.repsLooksLikeSeconds')
            expect(issue.code === 'custom' && issue.params).toEqual({ suggestion: '60"' })
        }
    })
    it.each([
        ['10/8', 'validation.repsRangeOrder'],
        ['0', 'validation.repsOutOfRange'],
        ['400"', 'validation.secondsOutOfRange'],
    ])('rejects %j with %s', (value, key) => {
        const result = repsSchema.safeParse(value)
        expect(result.success).toBe(false)
        if (!result.success) expect(result.error.issues[0].message).toBe(key)
    })
})

describe('checkReps errors', () => {
    it.each([
        ['', 'format'],
        ['8-10', 'format'],
        ['abc', 'format'],
        ['30/45"', 'format'],
        ['0', 'repsOutOfRange'],
        ['0/5', 'repsOutOfRange'],
        ['301', 'repsOutOfRange'],
        ['10/301', 'repsOutOfRange'],
        ['10/5', 'rangeOrder'],
        ['8/8', 'rangeOrder'],
        ['45"/30"', 'rangeOrder'],
        ['0"', 'secondsOutOfRange'],
        ['301"', 'secondsOutOfRange'],
        ['30"/301"', 'secondsOutOfRange'],
    ])('%j -> %s', (value, code) => {
        const result = checkReps(value)
        expect(result.ok).toBe(false)
        if (!result.ok) expect(result.error).toEqual({ code })
    })
    it.each([
        ['60', '60"'],
        ['51', '51"'],
        ['300', '300"'],
        ['45/60', '45"/60"'],
        ['30/90', '30"/90"'],
    ])('%j looks like seconds -> suggests %j', (value, suggestion) => {
        expect(checkReps(value)).toEqual({ ok: false, error: { code: 'looksLikeSeconds', suggestion } })
    })
    it('returns the parsed value when valid', () => {
        expect(checkReps('8/10')).toEqual({ ok: true, reps: { kind: 'reps', min: 8, max: 10 } })
    })
})
